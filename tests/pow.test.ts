import { describe, it, expect } from "vitest";
import { verifySolution, leadingZeroBits } from "../lib/core/pow";
import { createHash } from "node:crypto";

describe("leadingZeroBits", () => {
  it("counts all-zero bytes as 8 bits each", () => {
    expect(leadingZeroBits(Buffer.from([0, 0]))).toBe(16);
  });

  it("counts leading zeros in a partial byte", () => {
    // 00001111 = 4 leading zeros
    expect(leadingZeroBits(Buffer.from([0x0f]))).toBe(4);
    // 00010000 = 3 leading zeros
    expect(leadingZeroBits(Buffer.from([0x10]))).toBe(3);
  });

  it("returns 0 when the first bit is 1", () => {
    expect(leadingZeroBits(Buffer.from([0x80]))).toBe(0);
  });
});

describe("verifySolution", () => {
  it("accepts a valid nonce", () => {
    const salt = "test-salt";
    for (let nonce = 0; nonce < 1000; nonce++) {
      const hash = createHash("sha256").update(`${salt}${nonce}`).digest();
      if (leadingZeroBits(hash) >= 1) {
        expect(verifySolution(salt, nonce, 1)).toBe(true);
        return;
      }
    }
    expect.fail("should have found a valid nonce");
  });

  it("rejects an invalid nonce for high difficulty", () => {
    expect(verifySolution("test-salt", 0, 32)).toBe(false);
  });

  it("rejects negative nonces", () => {
    expect(verifySolution("test-salt", -1, 1)).toBe(false);
  });

  it("rejects non-finite nonces", () => {
    expect(verifySolution("test-salt", Number.NaN, 1)).toBe(false);
    expect(verifySolution("test-salt", Number.POSITIVE_INFINITY, 1)).toBe(false);
  });
});
