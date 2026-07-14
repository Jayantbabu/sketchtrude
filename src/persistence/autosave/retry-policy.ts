/** Delays from the brief: 1s, 2s, 4s, 8s, 15s, capped at 30s. */
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000] as const;
const MAX_BACKOFF_MS = 30_000;

/**
 * Whether an HTTP (or network) status should be retried.
 * status 0 = network failure / aborted without response.
 */
export function shouldRetry(status: number): boolean {
  if (status === 0) return true;
  if (status === 429) return true;
  if (status === 502 || status === 503 || status === 504) return true;
  return false;
}

export function isNonRetryableStatus(status: number): boolean {
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return true;
  }
  if (status === 409) return true;
  return false;
}

/**
 * Exponential backoff with jitter for attempt index (0-based).
 */
export function nextBackoffMs(attempt: number, random: () => number = Math.random): number {
  const index = Math.max(0, Math.min(attempt, BACKOFF_MS.length - 1));
  const base = BACKOFF_MS[index] ?? MAX_BACKOFF_MS;
  const jitter = random() * base * 0.25;
  return Math.min(MAX_BACKOFF_MS, Math.round(base + jitter));
}

export type RetryPolicy = {
  shouldRetry: typeof shouldRetry;
  nextBackoffMs: typeof nextBackoffMs;
  maxAttempts: number;
};

export const defaultRetryPolicy: RetryPolicy = {
  shouldRetry,
  nextBackoffMs,
  maxAttempts: 8,
};

export async function waitForBackoff(
  attempt: number,
  policy: Pick<RetryPolicy, "nextBackoffMs"> = defaultRetryPolicy,
): Promise<number> {
  const delay = policy.nextBackoffMs(attempt);
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  return delay;
}
