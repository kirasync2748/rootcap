/**
 * In-memory usage statistics for the rootcap API.
 *
 * Counters persist for the lifetime of the process — in the Vite dev server
 * this means until the server restarts; in serverless (Vercel) each
 * invocation gets its own counters. For persistent stats, pair with a
 * database or analytics service.
 */

interface Stats {
  challengesRequested: number;
  verificationsAttempted: number;
  verificationsSucceeded: number;
  verificationsFailed: number;
  startedAt: number;
}

const stats: Stats = {
  challengesRequested: 0,
  verificationsAttempted: 0,
  verificationsSucceeded: 0,
  verificationsFailed: 0,
  startedAt: Date.now(),
};

export function recordChallenge(): void {
  stats.challengesRequested++;
}

export function recordVerify(success: boolean): void {
  stats.verificationsAttempted++;
  if (success) {
    stats.verificationsSucceeded++;
  } else {
    stats.verificationsFailed++;
  }
}

export function getStats(): Stats & { uptime: number } {
  return { ...stats, uptime: Date.now() - stats.startedAt };
}

export function resetStats(): void {
  stats.challengesRequested = 0;
  stats.verificationsAttempted = 0;
  stats.verificationsSucceeded = 0;
  stats.verificationsFailed = 0;
  stats.startedAt = Date.now();
}
