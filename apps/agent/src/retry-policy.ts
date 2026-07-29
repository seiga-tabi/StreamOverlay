export type RetryDecision = Readonly<{
  retry: boolean;
  delayMs: number;
}>;

export function retryDelay(input: {
  attempt: number;
  maximumAttempts: number;
  retryable: boolean;
  retryAfterMs?: number;
  random?: () => number;
}): RetryDecision {
  if (!input.retryable || input.attempt >= input.maximumAttempts) {
    return { retry: false, delayMs: 0 };
  }
  const random = input.random ?? Math.random;
  const serverDelay = Math.min(Math.max(input.retryAfterMs ?? 0, 0), 60_000);
  const exponential = Math.min(1_000 * (2 ** Math.max(0, input.attempt - 1)), 30_000);
  const base = Math.max(serverDelay, exponential);
  const jitter = Math.floor(base * 0.2 * Math.max(0, Math.min(1, random())));
  return { retry: true, delayMs: Math.min(base + jitter, 60_000) };
}

export function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(resolve, delayMs);
    timer.unref();
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("aborted"));
    }, { once: true });
  });
}
