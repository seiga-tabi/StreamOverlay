import type { MissionUpdateMessage } from "@streamops/shared";

export function MissionOverlay({ mission }: { mission?: MissionUpdateMessage }) {
  if (!mission || mission.missions.length === 0) return null;
  return (
    <div className="mission-board">
      <div className="label">{mission.title ?? "오늘의 미션"}</div>
      {mission.missions.map((item) => (
        <div key={item.id} className={item.done ? "mission done" : "mission"}>{item.done ? "✓" : "•"} {item.text}</div>
      ))}
    </div>
  );
}
