#!/usr/bin/env node
/**
 * 아수라장(증강 칼바람) 실제 queueId 확정용 1회성 진단 스크립트.
 *
 * 서비스 코드를 건드리지 않고 Riot 원본만 읽습니다. 공식 queues.json 은 신규 모드를
 * 늦게 반영하므로 문서가 아니라 실매치 info 를 근거로 삼습니다.
 *
 * 사용법:
 *   RIOT_API_KEY=... node scripts/probe-riot-queue-id.mjs '맹금류애니비아#9314'
 *   node scripts/probe-riot-queue-id.mjs '맹금류애니비아#9314' --from 2026-08-14 --to 2026-08-17
 *
 * 옵션:
 *   --from / --to   스캔 날짜 창(UTC, to 는 미포함). 기본 2026-08-14 ~ 2026-08-17
 *   --region        account routing. 기본 asia (한국 서버)
 *   --max-detail    상세 조회 상한. 기본 60
 *
 * API 키는 헤더로만 보내고 어디에도 출력하지 않습니다. 로그의 URL 은 항상 키가 없는
 * 형태이며, 혹시 모를 노출을 막기 위해 출력 직전 한 번 더 마스킹합니다.
 */

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const riotId = args.find((value) => !value.startsWith("--")) ?? "";
const optionOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const FROM = Date.parse(`${optionOf("from", "2026-08-14")}T00:00:00Z`);
const TO = Date.parse(`${optionOf("to", "2026-08-17")}T00:00:00Z`);
const REGION = optionOf("region", "asia");
const MAX_DETAIL = Number(optionOf("max-detail", "60"));

/* 이미 확정된 큐 — 이 셋이 아니면 아수라장 후보입니다. */
const KNOWN_QUEUES = new Set([400, 420, 710]);
/* ids 기본 목록에서 못 찾았을 때만 시도하는 2xxx 대역 후보. */
const CANDIDATE_QUEUES = [2300, 2310, 2320, 2330, 2400, 2410];
const TYPE_VARIANTS = ["normal", "ranked", "tourney"];

const API_KEY = process.env.RIOT_API_KEY?.trim() || readSecretFile();

function readSecretFile() {
  try {
    return readFileSync("/run/secrets/riot_api_key", "utf8").trim();
  } catch {
    return "";
  }
}

if (!riotId.includes("#")) {
  console.error("Riot ID 를 'gameName#tagLine' 형식으로 넘겨 주세요.");
  process.exit(2);
}
if (!API_KEY) {
  console.error("RIOT_API_KEY 환경변수 또는 /run/secrets/riot_api_key 가 필요합니다.");
  process.exit(2);
}

/* 키가 어떤 경로로든 로그에 섞이지 않도록 출력 직전 마스킹합니다. */
const mask = (text) => String(text).split(API_KEY).join("<REDACTED>");
const log = (...parts) => console.log(mask(parts.join(" ")));

const calls = [];
let lastCallAt = 0;

async function riotFetch(path, label) {
  /* 개인 키 기준 100req/2min 을 넘기지 않도록 최소 간격을 둡니다. */
  const wait = 1_300 - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  const url = `https://${REGION}.api.riotgames.com${path}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    lastCallAt = Date.now();
    const response = await fetch(url, { headers: { "X-Riot-Token": API_KEY } });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? "5");
      log(`  · 429 rate limit — ${retryAfter}s 대기 후 재시도`);
      await new Promise((resolve) => setTimeout(resolve, (retryAfter + 1) * 1000));
      continue;
    }
    calls.push({ label, path, status: response.status });
    if (response.status === 404) return null;
    if (!response.ok) {
      log(`  · ${label} 실패 status=${response.status} path=${path}`);
      return null;
    }
    return response.json();
  }
  calls.push({ label, path, status: 429 });
  return null;
}

const isoDay = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 19) + "Z";

/** participants 의 playerAugment1~6 채움 여부만 요약합니다(값 자체는 샘플 2개까지). */
function augmentSummary(match) {
  const participants = match?.info?.participants ?? [];
  const filled = [1, 2, 3, 4, 5, 6].map((slot) => {
    const key = `playerAugment${slot}`;
    const withValue = participants.filter((participant) => Number(participant?.[key]) > 0);
    return { slot, count: withValue.length, sample: withValue.slice(0, 2).map((p) => p[key]) };
  });
  return { participants: participants.length, filled };
}

async function main() {
  const [gameName, tagLine] = riotId.split("#");
  log(`▶ account-v1 조회: ${gameName}#${tagLine} (routing=${REGION})`);
  const account = await riotFetch(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    "account.by_riot_id"
  );
  if (!account?.puuid) {
    log("✖ puuid 를 찾지 못했습니다. Riot ID 와 routing 을 확인해 주세요.");
    return report();
  }
  const puuid = account.puuid;
  log(`  puuid 확보 (앞 8자: ${puuid.slice(0, 8)}…)\n`);

  /* 1) 파라미터 없는 기본 ids 목록을 start=0,100 으로 페이지네이션 */
  const baseIds = [];
  for (const start of [0, 100]) {
    const page = await riotFetch(
      `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=${start}&count=100`,
      "match.ids(no params)"
    );
    if (!Array.isArray(page) || page.length === 0) break;
    baseIds.push(...page);
    if (page.length < 100) break;
  }
  const baseIdSet = new Set(baseIds);
  log(`▶ 기본 ids 목록(파라미터 없음): ${baseIds.length}건\n`);

  /* 2) 최신순이므로 창을 벗어나면 즉시 중단 — 상세 호출을 최소화합니다. */
  log(`▶ ${isoDay(FROM)} ~ ${isoDay(TO)} 구간 상세 조회`);
  const inWindow = [];
  let scanned = 0;
  for (const matchId of baseIds) {
    if (scanned >= MAX_DETAIL) {
      log(`  · --max-detail(${MAX_DETAIL}) 도달 — 중단`);
      break;
    }
    const match = await riotFetch(`/lol/match/v5/matches/${encodeURIComponent(matchId)}`, "match.detail");
    scanned += 1;
    const created = Number(match?.info?.gameCreation ?? 0);
    if (!created) continue;
    if (created < FROM) {
      log(`  · ${isoDay(created)} 로 창 이전 도달 — 스캔 종료`);
      break;
    }
    if (created >= TO) continue;

    const info = match.info;
    const row = {
      matchId,
      queueId: info.queueId,
      gameMode: info.gameMode,
      gameType: info.gameType,
      gameName: info.gameName,
      gameCreation: isoDay(created),
      inBaseList: baseIdSet.has(matchId),
      augments: augmentSummary(match)
    };
    inWindow.push(row);
    const flag = KNOWN_QUEUES.has(info.queueId) ? "" : "  ★ 후보";
    /* 증강 채움 여부는 모든 매치에 대해 찍습니다 — 이미 확정했다고 본 큐(710 등)가
       사실은 아수라장인지 여부가 여기서 바로 갈립니다. 추가 호출은 없습니다. */
    const augmented = row.augments.filled.filter((slot) => slot.count > 0).map((slot) => slot.slot);
    const augmentNote = augmented.length > 0 ? `  augments=[${augmented.join(",")}]` : "  augments=none";
    log(`  ${row.gameCreation}  queueId=${info.queueId}  ${info.gameMode}/${info.gameType}${augmentNote}${flag}`);
  }

  const candidates = inWindow.filter((row) => !KNOWN_QUEUES.has(row.queueId));
  log("");

  /* 큐별 요약 — "710 = 특별 랭크"라는 기존 가정을 검증하는 표입니다.
     gameMode 가 ARAM 이고 증강이 채워져 있으면 그 큐가 곧 아수라장입니다. */
  log("▶ 큐별 요약");
  const byQueue = new Map();
  for (const row of inWindow) {
    const entry = byQueue.get(row.queueId) ?? { count: 0, modes: new Set(), augmented: 0, inBase: 0 };
    entry.count += 1;
    entry.modes.add(`${row.gameMode}/${row.gameType}`);
    if (row.augments.filled.some((slot) => slot.count > 0)) entry.augmented += 1;
    if (row.inBaseList) entry.inBase += 1;
    byQueue.set(row.queueId, entry);
  }
  for (const [queueId, entry] of [...byQueue].sort((a, b) => a[0] - b[0])) {
    log(`  queueId=${queueId}  ${entry.count}건  ${[...entry.modes].join(",")}  증강매치=${entry.augmented}  기본목록포함=${entry.inBase}/${entry.count}`);
  }
  log("");

  /* 3) 기본 목록에 없으면 큐 직접 조회와 type 변형을 시도 */
  if (candidates.length === 0) {
    log("▶ 기본 목록에 후보 없음 — 큐 직접 조회 시도");
    for (const queueId of CANDIDATE_QUEUES) {
      const ids = await riotFetch(
        `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=20&queue=${queueId}`,
        `match.ids(queue=${queueId})`
      );
      const count = Array.isArray(ids) ? ids.length : 0;
      const unseen = Array.isArray(ids) ? ids.filter((id) => !baseIdSet.has(id)).length : 0;
      log(`  queue=${queueId}: ${count}건 (기본 목록에 없는 것 ${unseen}건)`);
      if (count > 0) {
        const detail = await riotFetch(`/lol/match/v5/matches/${encodeURIComponent(ids[0])}`, "match.detail");
        if (detail?.info) {
          log(`    → 최신 1건 queueId=${detail.info.queueId} ${detail.info.gameMode}/${detail.info.gameType} ${isoDay(detail.info.gameCreation)}`);
          log(`    → augments: ${JSON.stringify(augmentSummary(detail).filled)}`);
        }
      }
    }
    for (const type of TYPE_VARIANTS) {
      const ids = await riotFetch(
        `/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=20&type=${type}`,
        `match.ids(type=${type})`
      );
      const unseen = Array.isArray(ids) ? ids.filter((id) => !baseIdSet.has(id)) : [];
      log(`  type=${type}: ${Array.isArray(ids) ? ids.length : 0}건 (기본 목록에 없는 것 ${unseen.length}건)`);
    }
  } else {
    log("▶ 후보 매치 상세");
    for (const row of candidates) {
      log(JSON.stringify(row, null, 2));
    }
  }

  report();
}

function report() {
  log("\n=== 실행한 조회 목록 ===");
  const grouped = new Map();
  for (const call of calls) {
    const key = `${call.label} status=${call.status}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  for (const [key, count] of grouped) log(`  ${key}: ${count}건`);
  log(`  총 ${calls.length}건`);
}

main().catch((error) => {
  console.error(mask(error?.stack ?? String(error)));
  process.exit(1);
});
