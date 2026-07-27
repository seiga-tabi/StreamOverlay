import type { PalworldTechnologyUnlockSummary } from "@streamops/shared";

export type TechnologyUnlockGroup = {
  level: number;
  items: PalworldTechnologyUnlockSummary[];
};

export function groupTechnologyUnlockItems(
  items: PalworldTechnologyUnlockSummary[],
): TechnologyUnlockGroup[] {
  const groups: TechnologyUnlockGroup[] = [];
  const groupByLevel = new Map<number, TechnologyUnlockGroup>();

  for (const item of items) {
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
