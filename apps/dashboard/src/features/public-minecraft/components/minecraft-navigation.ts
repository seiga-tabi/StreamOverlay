import { minecraftI18n } from "../i18n/minecraft-i18n";
import type { MinecraftPage } from "../utils/routes";

/* 상단 nav 와 하단 탭바가 공유하는 단일 원본 — 라벨·순서·활성 판정이 어긋나지 않게. */
export const minecraftNavItems: Array<{ page: MinecraftPage; ko: string; ja: string }> = [
  { page: "home", ko: minecraftI18n.ko.home, ja: minecraftI18n.ja.home },
  { page: "recipes", ko: minecraftI18n.ko.recipes, ja: minecraftI18n.ja.recipes },
  { page: "items", ko: minecraftI18n.ko.items, ja: minecraftI18n.ja.items },
  { page: "enchants", ko: minecraftI18n.ko.enchants, ja: minecraftI18n.ja.enchants },
  { page: "library", ko: minecraftI18n.ko.library, ja: minecraftI18n.ja.library },
  { page: "patchNotes", ko: minecraftI18n.ko.patchNotes, ja: minecraftI18n.ja.patchNotes },
];

/* 하단 탭바는 5칸 규칙 — 인챈트는 상단 nav 와 위키 홈 타일로 접근합니다. */
export const minecraftTabItems = minecraftNavItems.filter((item) => item.page !== "enchants");

