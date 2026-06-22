import type { SubtitleBoostMessage, SubtitleUpdateMessage } from "@streamops/shared";
import { SubtitleBox } from "../components/SubtitleBox";

export function SubtitleOverlay({ subtitle, boost }: { subtitle?: SubtitleUpdateMessage; boost?: SubtitleBoostMessage }) {
  return (
    <div className="subtitle-layer">
      {boost ? (
        <div className={`subtitle-boost ${boost.variant ?? "success"}`}>
          <strong>{boost.title ?? "字幕ブースト"}</strong>
          {boost.message ? <span>{boost.message}</span> : null}
        </div>
      ) : null}
      {subtitle ? <SubtitleBox {...subtitle} boosted={Boolean(boost)} /> : null}
    </div>
  );
}
