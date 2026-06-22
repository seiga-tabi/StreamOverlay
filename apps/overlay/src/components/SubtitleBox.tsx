export function SubtitleBox({
  original,
  translated,
  isFinal,
  boosted
}: {
  original?: string;
  translated: string;
  isFinal: boolean;
  boosted?: boolean;
}) {
  const i18n = {
    ko: {
      autoNote: "자동 번역 자막이므로 오역이 포함될 수 있습니다."
    },
    ja: {
      autoNote: "自動翻訳字幕のため、誤訳が含まれる場合があります。"
    }
  };
  const t = i18n.ja;

  return (
    <div className={`subtitle ${isFinal ? "final" : "partial"} ${boosted ? "boosted" : ""}`}>
      <div className="ja"><span>JA</span>{translated}</div>
      {original ? <div className="ko"><span>KO</span>{original}</div> : null}
      <div className="auto-note" data-ko={i18n.ko.autoNote} data-ja={i18n.ja.autoNote}>{t.autoNote}</div>
    </div>
  );
}
