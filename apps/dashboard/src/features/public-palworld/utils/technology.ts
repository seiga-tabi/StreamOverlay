import type { PalworldItemSummary } from "@streamops/shared";

export type TechnologyUnlockGroup = {
  level: number;
  items: PalworldItemSummary[];
};

export function groupTechnologyUnlockItems(
  items: PalworldItemSummary[],
): TechnologyUnlockGroup[] {
  const groups: TechnologyUnlockGroup[] = [];
  const groupByLevel = new Map<number, TechnologyUnlockGroup>();

  for (const item of items) {
    if (item.technologyLevel === undefined) continue;
    const existing = groupByLevel.get(item.technologyLevel);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    const group = {
      level: item.technologyLevel,
      items: [item],
    };
    groupByLevel.set(item.technologyLevel, group);
    groups.push(group);
  }

  return groups;
}
