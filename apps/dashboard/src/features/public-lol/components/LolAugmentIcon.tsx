import { useEffect, useState } from "react";
import { activePublicLocale } from "../i18n/public-lol-i18n";

/* 증강 아이콘(증강 칼바람 큐 2400 등) — Community Dragon 실게임 에셋.
 *
 * 메타(id→이름·희귀도·아이콘 경로)는 cdragon 증강 JSON 을 언어별로 1회만 받아
 * 모듈 캐시에 둡니다. 실패하면 희귀도 미상 프레임 + id 텍스트로 닫힙니다(가짜 금지).
 * 근거: docs/mockups/aram-mayhem-records.html §증강 슬롯 · 실자산 검증 2026-08-16 */

const CDRAGON_ORIGIN = "https://raw.communitydragon.org";

type AugmentMeta = { name: string; rarity: number; iconPath: string };

const cache = new Map<string, Promise<Map<number, AugmentMeta>>>();

function metadataLocale(): string {
  return activePublicLocale === "ja" ? "ja_jp" : "ko_kr";
}

async function loadAugmentMetadata(locale: string): Promise<Map<number, AugmentMeta>> {
  const response = await fetch(`${CDRAGON_ORIGIN}/latest/cdragon/arena/${locale}.json`);
  if (!response.ok) throw new Error(`augment metadata ${response.status}`);
  const payload = (await response.json()) as { augments?: unknown } | unknown[];
  const list = Array.isArray(payload) ? payload : (payload.augments as unknown[] | undefined) ?? [];
  const byId = new Map<number, AugmentMeta>();
  for (const entry of list) {
    const item = entry as { id?: number; name?: string; rarity?: number; iconLarge?: string; iconSmall?: string };
    const icon = item.iconLarge ?? item.iconSmall;
    if (typeof item.id !== "number" || typeof item.name !== "string" || typeof icon !== "string") continue;
    byId.set(item.id, { name: item.name, rarity: item.rarity ?? 0, iconPath: icon.toLowerCase() });
  }
  return byId;
}

function augmentMetadata(): Promise<Map<number, AugmentMeta>> {
  const locale = metadataLocale();
  let pending = cache.get(locale);
  if (!pending) {
    pending = loadAugmentMetadata(locale);
    /* 실패 시 캐시를 비워 다음 렌더에서 재시도할 수 있게 합니다. */
    pending.catch(() => cache.delete(locale));
    cache.set(locale, pending);
  }
  return pending;
}

/* rarity: 0=실버 · 1=골드 · 그 외(프리즘 계열)=프리즘 프레임 */
function rarityClass(rarity: number | undefined): string {
  if (rarity === undefined) return "";
  if (rarity === 0) return " is-silver";
  if (rarity === 1) return " is-gold";
  return " is-prism";
}

export function LolAugmentIcon({ id, order }: { id: number; order?: number }) {
  const [meta, setMeta] = useState<AugmentMeta | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    augmentMetadata()
      .then((byId) => {
        if (disposed) return;
        const found = byId.get(id);
        if (found) setMeta(found);
        else setFailed(true);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
    };
  }, [id]);

  const title = meta?.name ?? `Augment ${id}`;
  return (
    <span className={`lol-augment${rarityClass(meta?.rarity)}`} title={title}>
      {order !== undefined ? <small aria-hidden="true">{order}</small> : null}
      {meta && !failed ? (
        <img
          alt={title}
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={`${CDRAGON_ORIGIN}/latest/game/${meta.iconPath}`}
        />
      ) : (
        <span aria-hidden="true" className="lol-augment__fallback">A</span>
      )}
      <span className="yoro-u-sr-only">{title}</span>
    </span>
  );
}
