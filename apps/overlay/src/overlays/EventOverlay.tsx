import type { EmergencyShowMessage, OverlayBannerMessage } from "@streamops/shared";
import { Banner } from "../components/Banner";

export function EventOverlay({
  banner,
  emergency,
  onBannerComplete
}: {
  banner?: OverlayBannerMessage;
  emergency?: EmergencyShowMessage;
  onBannerComplete?: (banner: OverlayBannerMessage) => void;
}) {
  return (
    <div className="event-layer">
      {emergency ? (
        <div className={`emergency-card ${emergency.variant ?? "danger"}`}>
          <div className="emergency-title">{emergency.title}</div>
          <div className="emergency-message">{emergency.message}</div>
        </div>
      ) : null}
      {banner ? <Banner banner={banner} onComplete={onBannerComplete} /> : null}
    </div>
  );
}
