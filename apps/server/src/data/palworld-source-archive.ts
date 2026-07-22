import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 65_557;
const DEFAULT_MAX_ENTRIES = 5_000;
const DEFAULT_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

export type PalworldZipEntry = {
  name: string;
  compressedBytes: number;
  uncompressedBytes: number;
  crc32: number;
  compressionMethod: 0 | 8;
  localHeaderOffset: number;
  directory: boolean;
};

export class PalworldSourceArchiveError extends Error {
  readonly code = "PALWORLD_SOURCE_ARCHIVE_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "PalworldSourceArchiveError";
  }
}

function fail(message: string): never {
  throw new PalworldSourceArchiveError(message);
}

function assertSafeEntryName(name: string): void {
  if (
    name.length < 1
    || name.length > 512
    || name.includes("\0")
    || name.includes("\\")
    || name.includes("\ufffd")
    || name.startsWith("/")
    || /^[A-Za-z]:/u.test(name)
  ) {
    fail(`안전하지 않은 ZIP entry 경로입니다: ${JSON.stringify(name)}`);
  }
  const comparable = name.endsWith("/") ? name.slice(0, -1) : name;
  if (comparable.length < 1 || comparable.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    fail(`안전하지 않은 ZIP entry 경로 segment입니다: ${JSON.stringify(name)}`);
  }
}

async function readExact(handle: FileHandle, length: number, position: number): Promise<Buffer> {
  if (!Number.isSafeInteger(length) || length < 0 || !Number.isSafeInteger(position) || position < 0) {
    fail("ZIP read 범위가 올바르지 않습니다.");
  }
  const buffer = Buffer.allocUnsafe(length);
  const { bytesRead } = await handle.read(buffer, 0, length, position);
  if (bytesRead !== length) fail("ZIP 파일을 예상한 길이만큼 읽지 못했습니다.");
  return buffer;
}

let crcTable: Uint32Array | undefined;

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    crcTable[value] = crc >>> 0;
  }
  return crcTable;
}

export function crc32(buffer: Buffer): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function sha256File(filePath: string): Promise<{ sha256: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    let bytes = 0;
    const stream = createReadStream(filePath);
    stream.on("data", (chunk: string | Buffer) => {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      bytes += buffer.length;
      hash.update(buffer);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve({ sha256: hash.digest("hex"), bytes }));
  });
}

export class PalworldSourceArchive {
  readonly filePath: string;
  readonly entries: ReadonlyMap<string, PalworldZipEntry>;
  readonly totalUncompressedBytes: number;
  #handle: FileHandle;

  private constructor(input: {
    filePath: string;
    handle: FileHandle;
    entries: Map<string, PalworldZipEntry>;
    totalUncompressedBytes: number;
  }) {
    this.filePath = input.filePath;
    this.#handle = input.handle;
    this.entries = input.entries;
    this.totalUncompressedBytes = input.totalUncompressedBytes;
  }

  static async open(filePath: string, options: {
    maxEntries?: number;
    maxTotalUncompressedBytes?: number;
  } = {}): Promise<PalworldSourceArchive> {
    const handle = await open(filePath, "r");
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size < 22) fail("ZIP source는 비어 있지 않은 regular file이어야 합니다.");
      const tailLength = Math.min(stat.size, MAX_EOCD_SEARCH);
      const tailOffset = stat.size - tailLength;
      const tail = await readExact(handle, tailLength, tailOffset);
      let eocdOffset = -1;
      for (let offset = tail.length - 22; offset >= 0; offset -= 1) {
        if (tail.readUInt32LE(offset) === EOCD_SIGNATURE) {
          const commentLength = tail.readUInt16LE(offset + 20);
          if (offset + 22 + commentLength === tail.length) {
            eocdOffset = offset;
            break;
          }
        }
      }
      if (eocdOffset < 0) fail("ZIP central directory footer를 찾을 수 없습니다.");
      const diskNumber = tail.readUInt16LE(eocdOffset + 4);
      const centralDisk = tail.readUInt16LE(eocdOffset + 6);
      const diskEntries = tail.readUInt16LE(eocdOffset + 8);
      const totalEntries = tail.readUInt16LE(eocdOffset + 10);
      const centralBytes = tail.readUInt32LE(eocdOffset + 12);
      const centralOffset = tail.readUInt32LE(eocdOffset + 16);
      if (diskNumber !== 0 || centralDisk !== 0 || diskEntries !== totalEntries) fail("분할 ZIP archive는 허용하지 않습니다.");
      if (totalEntries === 0xffff || centralBytes === 0xffffffff || centralOffset === 0xffffffff) {
        fail("ZIP64 archive는 고정 source 형식으로 허용하지 않습니다.");
      }
      const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
      if (totalEntries < 1 || totalEntries > maxEntries) fail(`ZIP entry 수가 허용 범위를 벗어납니다: ${totalEntries}`);
      if (centralOffset + centralBytes > tailOffset + eocdOffset) fail("ZIP central directory 범위가 파일을 벗어납니다.");

      const central = await readExact(handle, centralBytes, centralOffset);
      const entries = new Map<string, PalworldZipEntry>();
      let cursor = 0;
      let totalUncompressedBytes = 0;
      for (let index = 0; index < totalEntries; index += 1) {
        if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
          fail(`ZIP central directory entry ${index}가 손상되었습니다.`);
        }
        const flags = central.readUInt16LE(cursor + 8);
        const compressionMethod = central.readUInt16LE(cursor + 10);
        const checksum = central.readUInt32LE(cursor + 16);
        const compressedBytes = central.readUInt32LE(cursor + 20);
        const uncompressedBytes = central.readUInt32LE(cursor + 24);
        const nameLength = central.readUInt16LE(cursor + 28);
        const extraLength = central.readUInt16LE(cursor + 30);
        const commentLength = central.readUInt16LE(cursor + 32);
        const diskStart = central.readUInt16LE(cursor + 34);
        const externalAttributes = central.readUInt32LE(cursor + 38);
        const localHeaderOffset = central.readUInt32LE(cursor + 42);
        const next = cursor + 46 + nameLength + extraLength + commentLength;
        if (next > central.length) fail(`ZIP central directory entry ${index} 범위가 손상되었습니다.`);
        if ((flags & 0x1) !== 0) fail("암호화된 ZIP entry는 허용하지 않습니다.");
        if (compressionMethod !== 0 && compressionMethod !== 8) fail(`허용되지 않은 ZIP 압축 방식입니다: ${compressionMethod}`);
        if (diskStart !== 0) fail("분할 ZIP entry는 허용하지 않습니다.");
        if ([compressedBytes, uncompressedBytes, localHeaderOffset].includes(0xffffffff)) fail("ZIP64 entry는 허용하지 않습니다.");
        const name = central.toString("utf8", cursor + 46, cursor + 46 + nameLength);
        assertSafeEntryName(name);
        if (entries.has(name)) fail(`중복 ZIP entry를 허용하지 않습니다: ${name}`);
        const unixMode = externalAttributes >>> 16;
        if ((unixMode & 0o170000) === 0o120000) fail(`symlink ZIP entry를 허용하지 않습니다: ${name}`);
        const directory = name.endsWith("/");
        if (directory && (compressedBytes !== 0 || uncompressedBytes !== 0)) fail(`directory entry에 payload를 허용하지 않습니다: ${name}`);
        totalUncompressedBytes += uncompressedBytes;
        if (totalUncompressedBytes > (options.maxTotalUncompressedBytes ?? DEFAULT_MAX_TOTAL_BYTES)) {
          fail("ZIP 전체 압축 해제 크기가 허용 범위를 초과합니다.");
        }
        entries.set(name, {
          name,
          compressedBytes,
          uncompressedBytes,
          crc32: checksum,
          compressionMethod: compressionMethod as 0 | 8,
          localHeaderOffset,
          directory
        });
        cursor = next;
      }
      if (cursor !== central.length) fail("ZIP central directory 뒤에 해석되지 않은 바이트가 있습니다.");
      return new PalworldSourceArchive({ filePath, handle, entries, totalUncompressedBytes });
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async readEntry(name: string, maxBytes: number): Promise<Buffer> {
    assertSafeEntryName(name);
    const entry = this.entries.get(name);
    if (!entry || entry.directory) fail(`필수 ZIP file entry가 없습니다: ${name}`);
    if (entry.uncompressedBytes > maxBytes || entry.compressedBytes > maxBytes) {
      fail(`ZIP entry 크기가 허용 범위를 초과합니다: ${name}`);
    }
    const localHeader = await readExact(this.#handle, 30, entry.localHeaderOffset);
    if (localHeader.readUInt32LE(0) !== LOCAL_SIGNATURE) fail(`ZIP local header가 손상되었습니다: ${name}`);
    const flags = localHeader.readUInt16LE(6);
    const method = localHeader.readUInt16LE(8);
    const nameLength = localHeader.readUInt16LE(26);
    const extraLength = localHeader.readUInt16LE(28);
    if ((flags & 0x1) !== 0 || method !== entry.compressionMethod) fail(`ZIP local header가 central directory와 일치하지 않습니다: ${name}`);
    const localName = await readExact(this.#handle, nameLength, entry.localHeaderOffset + 30);
    if (localName.toString("utf8") !== name) fail(`ZIP local header 파일명이 central directory와 일치하지 않습니다: ${name}`);
    const dataOffset = entry.localHeaderOffset + 30 + nameLength + extraLength;
    const compressed = await readExact(this.#handle, entry.compressedBytes, dataOffset);
    let output: Buffer;
    try {
      output = entry.compressionMethod === 0
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: maxBytes });
    } catch {
      fail(`ZIP entry 압축 해제에 실패했습니다: ${name}`);
    }
    if (output.length !== entry.uncompressedBytes) fail(`ZIP entry 압축 해제 크기가 일치하지 않습니다: ${name}`);
    if (crc32(output) !== entry.crc32) fail(`ZIP entry CRC32가 일치하지 않습니다: ${name}`);
    return output;
  }

  async close(): Promise<void> {
    await this.#handle.close();
  }
}
