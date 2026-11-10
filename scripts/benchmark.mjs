import { performance } from "node:perf_hooks";
import process from "node:process";
import console from "node:console";
import {
  generateChallenge,
  validateChallenge,
  verifySolution,
  securityProfiles,
} from "../dist/core/index.js";

const rounds = Number(process.argv[2] ?? 5);
if (!Number.isSafeInteger(rounds) || rounds < 1 || rounds > 100)
  throw new RangeError("rounds must be an integer from 1 to 100");
const secret = "rootcap-local-benchmark-secret";
const output = {};
for (const [name, options] of Object.entries(securityProfiles)) {
  const times = { issueMs: [], solveMs: [], verifyMs: [] };
  for (let i = 0; i < rounds; i++) {
    let start = performance.now();
    const challenge = generateChallenge(secret, options);
    times.issueMs.push(performance.now() - start);
    start = performance.now();
    const solutions = challenge.challenges.map(({ s, d }) => {
      let nonce = 0;
      while (!verifySolution(s, nonce, d)) nonce++;
      return nonce;
    });
    times.solveMs.push(performance.now() - start);
    start = performance.now();
    if (!validateChallenge(secret, { token: challenge.token, solutions }).success)
      throw new Error("benchmark proof failed");
    times.verifyMs.push(performance.now() - start);
  }
  output[name] = Object.fromEntries(
    Object.entries(times).map(([key, values]) => {
      values.sort((a, b) => a - b);
      return [
        key,
        {
          p50: Number(values[Math.floor((values.length - 1) * 0.5)].toFixed(2)),
          p95: Number(values[Math.ceil((values.length - 1) * 0.95)].toFixed(2)),
        },
      ];
    }),
  );
}
console.log(
  JSON.stringify(
    { runtime: process.version, rounds, unit: "milliseconds", profiles: output },
    null,
    2,
  ),
);
