/** Starting points for count and difficulty. Benchmark on representative devices. */
export const securityProfiles = Object.freeze({
  light: Object.freeze({ count: 25, difficulty: 3 }),
  balanced: Object.freeze({ count: 50, difficulty: 4 }),
  strict: Object.freeze({ count: 75, difficulty: 6 }),
});
