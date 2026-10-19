/// <reference lib="webworker" />

/**
 * Proof-of-work solver that runs inside a Web Worker.
 * Finds a nonce such that SHA-256(`${salt}${nonce}`) has at least
 * `difficulty` leading zero bits — the same computation the server verifies.
 */

function leadingZeroBits(hash: Uint8Array): number {
  let bits = 0;
  for (const byte of hash) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    let b = byte;
    while ((b & 0x80) === 0) {
      bits++;
      b = (b << 1) & 0xff;
    }
    break;
  }
  return bits;
}

async function solveOne(salt: string, difficulty: number, encoder: TextEncoder): Promise<number> {
  let nonce = 0;
  // Batch size keeps the worker responsive while still being fast.
  const batchSize = 2048;
  while (true) {
    for (let i = 0; i < batchSize; i++) {
      const data = encoder.encode(`${salt}${nonce}`);
      const digest = await crypto.subtle.digest("SHA-256", data);
      if (leadingZeroBits(new Uint8Array(digest)) >= difficulty) {
        return nonce;
      }
      nonce++;
    }
    // Yield to the event loop so progress messages can flow.
    await new Promise((r) => setTimeout(r, 0));
  }
}

interface SolveRequest {
  id: number;
  challenges: { s: string; d: number }[];
}

self.onmessage = async (e: MessageEvent<SolveRequest>) => {
  const { id, challenges } = e.data;
  const encoder = new TextEncoder();
  const solutions: number[] = [];

  for (let i = 0; i < challenges.length; i++) {
    const sol = await solveOne(challenges[i].s, challenges[i].d, encoder);
    solutions.push(sol);
    self.postMessage({
      type: "progress",
      id,
      index: i + 1,
      total: challenges.length,
    });
  }

  self.postMessage({ type: "done", id, solutions });
};
