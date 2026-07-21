import type { HTMLAttributes } from "react";
import type { PalworldLocale } from "../i18n/palworld-i18n";

export function LocalizedText({
  as = "span",
  ja,
  ko,
  locale,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "span" | "strong" | "small" | "p";
  ja: string;
  ko: string;
  locale: PalworldLocale;
}) {
  const children = locale === "ja" ? ja : ko;
  const shared = { ...props, "data-ja": ja, "data-ko": ko };
  if (as === "strong") return <strong {...shared}>{children}</strong>;
  if (as === "small") return <small {...shared}>{children}</small>;
  if (as === "p") return <p {...shared}>{children}</p>;
  return <span {...shared}>{children}</span>;
}
