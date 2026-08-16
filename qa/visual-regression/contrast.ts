import type { Locator, Page } from "@playwright/test";

/* 렌더된 글자와 그 자리의 실제 배경으로 WCAG 대비를 재는 공용 검사.
 *
 * 이 저장소에서 저대비 회귀는 두 가지 모양으로 반복됐습니다.
 *  1. 라이트 표면용 선택기를 다크 패널로 옮기면서 잉크 token 을 그대로 들고 옴
 *     (.yoro-pn-who 가 --pn-ink 를 쓴 채 다크 모듈로 이사 → 실측 1.14:1)
 *  2. 페이지가 팔레트를 다크로 재정의하면서 글자 token 만 뒤집고 버튼 배경
 *     token 은 밝은 기본값을 남겨 둠 (.bot-management-page → 실측 2.16:1)
 * 둘 다 눈으로는 "좀 흐리네" 정도로 지나가기 쉬워 계산으로 고정합니다.
 *
 * 배경은 조상을 거슬러 올라가며 반투명 층을 합성해 첫 불투명 색에서 멈춥니다.
 * 불투명 배경을 못 찾으면 계산이 성립하지 않으므로 건너뛰고 따로 보고합니다
 * (그런 경우는 픽셀로 직접 재야 합니다).
 */

export type ContrastFinding = {
  /** 어떤 요소인지 — 선택기와 글자 일부 */
  what: string;
  ratio: number;
  need: number;
  color: string;
  background: string;
  font: string;
};

export type ContrastAudit = {
  failures: ContrastFinding[];
  /** 불투명 배경을 찾지 못해 계산을 건너뛴 요소 */
  skipped: string[];
};

export type ContrastOptions = {
  /** 검사 범위. 생략하면 document.body 전체입니다. */
  scope?: string;
  /** 이 선택기에 해당하거나 그 안에 있는 글자만 봅니다. 예: 버튼만 보기. */
  match?: string;
};

/** 컨트롤(버튼·링크)만 보는 흔한 조합. */
export const INTERACTIVE = "button, a, [role='button'], [role='link'], summary";

/** `scope` 안의 글자 대비를 재고 AA 미달만 돌려줍니다. */
export async function auditContrast(
  target: Page | Locator,
  options: ContrastOptions | string = {}
): Promise<ContrastAudit> {
  const page: Page = "page" in target ? (target as Locator).page() : (target as Page);
  const resolved: ContrastOptions = typeof options === "string" ? { scope: options } : options;
  return page.evaluate(({ selector, match }: { selector: string | null; match: string | null }): ContrastAudit => {
    const parse = (value: string) => {
      const match = /rgba?\(([^)]+)\)/u.exec(value || "");
      if (!match?.[1]) return null;
      const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
      return { r: parts[0]!, g: parts[1]!, b: parts[2]!, a: parts.length > 3 ? parts[3]! : 1 };
    };
    const channel = (value: number): number => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (c: { r: number; g: number; b: number }): number =>
      0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    const backdrop = (element: Element) => {
      let node: Element | null = element;
      let acc: { r: number; g: number; b: number; a: number } | null = null;
      while (node) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0) {
          if (!acc) acc = { r: bg.r, g: bg.g, b: bg.b, a: bg.a };
          else {
            const a = acc.a;
            acc = {
              r: acc.r * a + bg.r * (1 - a),
              g: acc.g * a + bg.g * (1 - a),
              b: acc.b * a + bg.b * (1 - a),
              a: a + bg.a * (1 - a)
            };
          }
          if (acc.a >= 0.99) return acc;
        }
        node = node.parentElement;
      }
      return acc;
    };
    const describe = (element: Element): string => {
      const cls = element.className.toString().trim().split(/\s+/u).filter(Boolean).join(".");
      return element.tagName.toLowerCase() + (cls ? `.${cls}` : "");
    };

    const roots: Element[] = selector ? [...document.querySelectorAll(selector)] : [document.body];
    const failures: ContrastFinding[] = [];
    const skipped: string[] = [];
    const seen = new Set<string>();

    for (const root of roots) {
      for (const element of [root, ...root.querySelectorAll("*")]) {
        /* 비활성 컨트롤은 WCAG 1.4.3 대상이 아닙니다. */
        if (element.closest("[aria-disabled='true']") || element.closest(":disabled")) continue;
        if (match && !element.closest(match)) continue;

        const own = [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => (node.textContent ?? "").trim())
          .join("");
        if (!own) continue;

        const box = element.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) continue;
        const style = getComputedStyle(element);
        if (style.visibility === "hidden" || style.opacity === "0") continue;

        const fg = parse(style.color);
        const bg = backdrop(element);
        const what = `${describe(element)} "${own.slice(0, 14)}"`;
        if (!fg || !bg || bg.a < 0.99) {
          skipped.push(what);
          continue;
        }

        const blended = fg.a >= 1 ? fg : {
          r: fg.r * fg.a + bg.r * (1 - fg.a),
          g: fg.g * fg.a + bg.g * (1 - fg.a),
          b: fg.b * fg.a + bg.b * (1 - fg.a)
        };
        const l1 = luminance(blended);
        const l2 = luminance(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

        const size = Number.parseFloat(style.fontSize);
        const weight = Number.parseInt(style.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const need = large ? 3 : 4.5;
        if (ratio >= need) continue;

        const background = `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`;
        const key = what + style.color + background;
        if (seen.has(key)) continue;
        seen.add(key);
        failures.push({
          what,
          ratio: Math.round(ratio * 100) / 100,
          need,
          color: style.color,
          background,
          font: `${size}px/${weight}`
        });
      }
    }
    return { failures, skipped };
  }, { selector: resolved.scope ?? null, match: resolved.match ?? null });
}

/** expect 메시지에 쓰기 좋은 한 줄 요약들. */
export function formatFindings(findings: ContrastFinding[]): string[] {
  return findings.map((f) =>
    `${f.what} ${f.ratio}:1 < ${f.need} (${f.font}, ${f.color} on ${f.background})`);
}
