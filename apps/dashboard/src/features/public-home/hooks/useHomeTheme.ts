import { useEffect, useState } from "react";
import { readStoredThemeRaw, saveStoredTheme } from "../../public-lol/utils/storage";
import type { PublicTheme } from "../../public-lol/types/public-lol";

/* 홈 계열(루트 홈·LoL 홈)은 다크가 기본입니다(목업 규칙). 공용 usePublicTheme 은
 * 라이트 기본이라, 저장값이 없을 때만 다크로 시작하고 명시적으로 토글했을 때만
 * 저장해 다른 공개 화면의 기본값 판정을 건드리지 않습니다. */
export function useHomeTheme() {
  const [theme, setTheme] = useState<PublicTheme>(() => readStoredThemeRaw() ?? "dark");

  useEffect(() => {
    document.documentElement.dataset.publicTheme = theme;
  }, [theme]);

  const toggleTheme = (): void => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      saveStoredTheme(next);
      return next;
    });
  };

  return { theme, toggleTheme };
}
