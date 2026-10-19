import { describe, it, expect } from "vitest";
import { signJWT, verifyJWT } from "../lib/core/jwt";

const SECRET = "test-secret-key-for-testing";

describe("signJWT", () => {
  it("produces a three-part token", () => {
    const token = signJWT(SECRET, { foo: "bar" });
    expect(token.split(".")).toHaveLength(3);
  });

  it("encodes the payload", () => {
    const token = signJWT(SECRET, { foo: "bar" });
    expect(verifyJWT(SECRET, token)).toEqual({ foo: "bar" });
  });
});

describe("verifyJWT", () => {
  it("returns the payload for a valid token", () => {
    const token = signJWT(SECRET, { exp: Date.now() + 10000 });
    const payload = verifyJWT<{ exp: number }>(SECRET, token);
    expect(payload).not.toBeNull();
    expect(payload!.exp).toBeTypeOf("number");
  });

  it("returns null for a token signed with a different secret", () => {
    const token = signJWT("wrong-secret", { foo: "bar" });
    expect(verifyJWT(SECRET, token)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(verifyJWT(SECRET, "not.a.jwt")).toBeNull();
    expect(verifyJWT(SECRET, "too-short")).toBeNull();
    expect(verifyJWT(SECRET, "")).toBeNull();
  });

  it("returns null for a tampered payload", () => {
    const token = signJWT(SECRET, { foo: "bar" });
    const parts = token.split(".");
    // eyJmb28iOiJoYWNrZWQifQ == base64url({"foo":"hacked"})
    const tampered = `${parts[0]}.eyJmb28iOiJoYWNrZWQifQ.${parts[2]}`;
    expect(verifyJWT(SECRET, tampered)).toBeNull();
  });
});
