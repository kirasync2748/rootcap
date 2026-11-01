import { createHmac, timingSafeEqual } from "node:crypto";

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

const HEADER = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));

export function signJWT(secret: string, payload: Record<string, unknown>): string {
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${HEADER}.${payloadB64}`;
  const sig = createHmac("sha256", secret).update(data).digest();
  return `${data}.${base64url(sig)}`;
}

export function verifyJWT<T = Record<string, unknown>>(secret: string, token: string): T | null {
  if (typeof token !== "string" || token.length > 16384) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (
    headerB64 !== HEADER ||
    !/^[A-Za-z0-9_-]+$/.test(payloadB64) ||
    !/^[A-Za-z0-9_-]+$/.test(sigB64)
  )
    return null;
  const data = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", secret).update(data).digest();
  const actual = base64urlDecode(sigB64);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
    return payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as T)
      : null;
  } catch {
    return null;
  }
}
