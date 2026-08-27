import { useEffect, useState } from "react";
import type { PublicTheme } from "../types/public-lol";
import { readStoredTheme, saveStoredTheme } from "../utils/storage";

export function usePublicTheme() {
  const [theme, setTheme] = useState<PublicTheme>(() => readStoredTheme());

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
