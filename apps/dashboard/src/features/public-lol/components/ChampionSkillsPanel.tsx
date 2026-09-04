import { Fragment } from "react";
import type {
  LolChampionDetailResponse,
  LolChampionPatchSpellChange,
  LolChampionSpellKey
} from "@streamops/shared";
import { t } from "../i18n/public-lol-i18n";
import {
  championDescriptionLines,
  fillChampionText,
  foldLevelValues,
  localizedChampionText
} from "../utils/champion-detail";
import { PatchDirectionBadge } from "./PatchDirectionBadge";

/* 챔피언 상세 「스킬」 패널 — 목업
 * `docs/mockups/lol-champion-detail-skills-stats.approved-spec.html` §02 배치안 A(세로 리스트).
 *
 * 패시브+QWER 5개를 한 화면에 펼칩니다. 행 구조는
 * [아이콘 48] [키 칩 + 이름 (+ 판정 태그)] [설명] [쿨타임·소모값·사거리 한 줄]이고,
 * 아이콘만 별도 열이라 긴 한국어 문장이 아이콘 밑으로 흘러내리지 않습니다.
 * 상호작용이 없어 탭 상태·키보드 이동 부담이 없습니다(§03·§10).
 *
 * 계수(AP/AD 스케일링)와 데미지 공식은 ddragon tooltip 에만 있고 description 에는
 * 없으므로 여기에도 없습니다 — 서버가 tooltip 을 아예 보내지 않습니다(§11).
 */

const SKILL_KEY_LABEL: Readonly<Record<"P" | LolChampionSpellKey, string>> = {
  P: "P",
  Q: "Q",
  W: "W",
  E: "E",
  R: "R"
};

type SkillMetaEntry = { label: string; value: string };

type SkillRow = {
  rowKey: string;
  keyLabel: string;
  name: string;
  descriptionLines: string[];
  iconUrl?: string;
  meta: SkillMetaEntry[];
  /** 패시브에는 쿨타임·소모값이 아예 없습니다 — 빈 칸 대신 사실을 한 줄로 말합니다(§02). */
  metaNone?: string;
  change?: LolChampionPatchSpellChange;
};

function cooldownText(cooldown: readonly number[] | undefined): string | undefined {
  const folded = foldLevelValues(cooldown ?? []);
  return folded === undefined ? undefined : `${folded}${t().championDetailSecondsSuffix}`;
}

function costText(spell: LolChampionDetailResponse["spells"][number]): string | undefined {
  if (!spell.costBurn) return undefined;
  const costType = localizedChampionText({ ko: spell.costTypeKo, ja: spell.costTypeJa, en: spell.costTypeEn });
  /* costBurn 은 Data Dragon 이 이미 접어 준 문자열입니다("30" · "55/65/75/85/95"). */
  return costType ? `${costType} ${spell.costBurn}` : spell.costBurn;
}

function rangeText(range: readonly number[] | undefined): string | undefined {
  return foldLevelValues(range ?? []);
}

function skillRows(detail: LolChampionDetailResponse): SkillRow[] {
  const changeByKey = new Map<LolChampionSpellKey, LolChampionPatchSpellChange>(
    (detail.patchChanges?.spells ?? []).map((change) => [change.key, change])
  );
  const rows: SkillRow[] = [];

  if (detail.passive) {
    const passive = detail.passive;
    rows.push({
      rowKey: "P",
      keyLabel: SKILL_KEY_LABEL.P,
      name: localizedChampionText({ ko: passive.nameKo, ja: passive.nameJa, en: passive.nameEn }) ?? passive.nameKo,
      descriptionLines: championDescriptionLines(
        localizedChampionText({ ko: passive.descriptionKo, ja: passive.descriptionJa, en: passive.descriptionEn })
      ),
      ...(passive.iconUrl ? { iconUrl: passive.iconUrl } : {}),
      meta: [],
      metaNone: t().championDetailSkillPassiveMeta
    });
  }

  for (const spell of detail.spells) {
    const cooldown = cooldownText(spell.cooldown);
    const cost = costText(spell);
    const range = rangeText(spell.range);
    const change = changeByKey.get(spell.key);
    rows.push({
      rowKey: spell.key,
      keyLabel: SKILL_KEY_LABEL[spell.key],
      name: localizedChampionText({ ko: spell.nameKo, ja: spell.nameJa, en: spell.nameEn }) ?? spell.nameKo,
      descriptionLines: championDescriptionLines(
        localizedChampionText({ ko: spell.descriptionKo, ja: spell.descriptionJa, en: spell.descriptionEn })
      ),
      ...(spell.iconUrl ? { iconUrl: spell.iconUrl } : {}),
      /* 없는 항목은 렌더하지 않습니다 — 빈 칸이 남으면 "로딩 중"으로 읽힙니다. */
      meta: [
        ...(cooldown ? [{ label: t().championDetailSkillCooldown, value: cooldown }] : []),
        ...(cost ? [{ label: t().championDetailSkillCost, value: cost }] : []),
        ...(range ? [{ label: t().championDetailSkillRange, value: range }] : [])
      ],
      ...(change ? { change } : {})
    });
  }

  return rows;
}

function SkillCooldownChange({ change }: { change: LolChampionPatchSpellChange }) {
  const cooldownField = change.fields.find((field) => field.field === "cooldown");
  if (!cooldownField) return null;
  const from = foldLevelValues(cooldownField.from);
  const to = foldLevelValues(cooldownField.to);
  if (from === undefined || to === undefined) return null;
  const suffix = t().championDetailSecondsSuffix;
  return (
    <dl className="public-cskill-meta public-cskill-meta-change">
      <div>
        <dt>{t().championDetailCooldownChange}</dt>
        <dd>
          {/* 배열 전체가 바뀌면 레벨마다 증감폭이 달라 +20 같은 단일 수로 요약할 수
              없습니다 — 화살표만 씁니다(목업 §06). */}
          <span className="public-cstat-delta" data-direction={change.direction}>
            <span className="public-cstat-from">{`${from}${suffix}`}</span>
            <span className="yoro-u-sr-only">{t().championDetailDeltaFrom}</span>
            <span aria-hidden="true" className="public-cstat-arrow">→</span>
            <em className="public-cstat-to">{`${to}${suffix}`}</em>
          </span>
        </dd>
      </div>
    </dl>
  );
}

export function ChampionSkillsPanel({ detail }: { detail: LolChampionDetailResponse }) {
  const rows = skillRows(detail);
  if (rows.length === 0) return null;
  const changedCount = detail.patchChanges?.spells.length ?? 0;

  return (
    <section aria-labelledby="public-champion-skills-title" className="public-champ-panel public-cdetail-panel">
      <div className="public-champ-head">
        <h2 id="public-champion-skills-title">{t().championDetailSkillsTitle}</h2>
        <span className="public-champ-pill">
          {fillChampionText(t().championDetailSkillsPill, { version: detail.dataDragonVersion })}
        </span>
      </div>

      {/* 변경이 하나도 없으면 이 줄부터 배지·태그까지 전부 사라집니다(§07 기본 상태). */}
      {changedCount > 0 ? (
        <p className="public-cpatch-note">
          {fillChampionText(t().championDetailSkillChangeNote, { count: changedCount })}
        </p>
      ) : null}

      <div className="public-cskill-list">
        {rows.map((row) => (
          <article className="public-cskill-row" key={row.rowKey}>
            <span className="public-cskill-figure">
              {/* 아이콘 옆에 이름 텍스트가 있으므로 아이콘은 장식입니다(§10). */}
              <span aria-hidden="true" className="public-cskill-icon">
                {row.iconUrl ? (
                  <img alt="" decoding="async" height="48" loading="lazy" src={row.iconUrl} width="48" />
                ) : (
                  <span className="public-cskill-icon-fallback">{row.keyLabel}</span>
                )}
              </span>
              {row.change ? <PatchDirectionBadge direction={row.change.direction} /> : null}
            </span>
            <div className="public-cskill-copy">
              <div className="public-cskill-title">
                <span className="public-cskill-key">{row.keyLabel}</span>
                {/* 5개짜리 목록은 표제 계층이 아니라 리스트라 h3 를 쓰지 않습니다(§10). */}
                <span className="public-cskill-name">{row.name}</span>
                {row.change ? (
                  <span className="public-cskill-tag" data-direction={row.change.direction}>
                    {row.change.direction === "buff" ? t().championDetailPatchBuffTag : t().championDetailPatchNerfTag}
                  </span>
                ) : null}
              </div>
              {row.descriptionLines.length > 0 ? (
                <p className="public-cskill-desc">
                  {/* 원문의 <br> 는 태그가 아니라 줄 배열로 들어옵니다 — 외부 문자열을
                      innerHTML 로 넣지 않습니다(utils/champion-detail.ts). */}
                  {row.descriptionLines.map((line, index) => (
                    <Fragment key={`${row.rowKey}-${index}`}>
                      {index > 0 ? <br /> : null}
                      {line}
                    </Fragment>
                  ))}
                </p>
              ) : null}
              {row.meta.length > 0 || row.metaNone ? (
                <dl className="public-cskill-meta">
                  {row.metaNone ? (
                    <div><dd className="public-cskill-meta-none">{row.metaNone}</dd></div>
                  ) : null}
                  {row.meta.map((entry) => (
                    <div key={entry.label}>
                      <dt>{entry.label}</dt>
                      <dd>{entry.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {row.change ? <SkillCooldownChange change={row.change} /> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
