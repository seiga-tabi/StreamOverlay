function canonicalBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.trim());
    if (parsed.pathname === "") parsed.pathname = "/";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function canReusePalworldServerPassword(
  savedBaseUrl: string | undefined,
  nextBaseUrl: string,
  passwordConfigured: boolean
): boolean {
  if (!passwordConfigured) return false;
  const saved = canonicalBaseUrl(savedBaseUrl);
  const next = canonicalBaseUrl(nextBaseUrl);
  return Boolean(saved && next && saved === next);
}

export type TransientPalworldAdminPasswordState = {
  current: () => string;
  update: (value: string) => void;
  finishOperation: () => void;
  dispose: () => void;
};

export function createTransientPalworldAdminPasswordState(
  commit: (value: string) => void
): TransientPalworldAdminPasswordState {
  let value = "";

  return {
    current: () => value,
    update: (nextValue) => {
      value = nextValue;
      commit(nextValue);
    },
    finishOperation: () => {
      value = "";
      commit("");
    },
    dispose: () => {
      // unmount 뒤에는 React state를 갱신하지 않고 보관 중인 민감값만 즉시 비운다.
      value = "";
    }
  };
}
