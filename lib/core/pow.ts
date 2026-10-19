import { createHash } from "node:crypto";

/**
 * Count the number of leading zero bits in a hash buffer.
 */
export function leadingZeroBits(hash: Buffer): number {
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

/**
 * Verify that a nonce produces a hash with at least `difficulty` leading zero bits.
 * The hash input is the UTF-8 encoding of `${salt}${nonce}`.
 */
export function verifySolution(salt: string, nonce: number, difficulty: number): boolean {
  if (!Number.isFinite(nonce) || nonce < 0) return false;
  const hash = createHash("sha256").update(`${salt}${nonce}`).digest();
  return leadingZeroBits(hash) >= difficulty;
}
