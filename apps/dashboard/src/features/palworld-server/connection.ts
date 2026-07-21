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
