import { describe, it, expect } from "vitest";
import { makeRawToken, makeRawCode } from "@/lib/token";

describe("makeRawToken", () => {
  it("produces a 10-character string", () => {
    const token = makeRawToken();
    expect(token).toHaveLength(10);
  });

  it("contains only URL-safe characters", () => {
    for (let i = 0; i < 100; i++) {
      const token = makeRawToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("generates unique tokens across many calls", () => {
    const tokens = new Set(Array.from({ length: 1000 }, makeRawToken));
    // With 10 base64url chars (2^48 space) collisions are astronomically unlikely
    expect(tokens.size).toBe(1000);
  });
});

describe("makeRawCode", () => {
  it("produces a 4-character numeric string", () => {
    for (let i = 0; i < 100; i++) {
      const code = makeRawCode();
      expect(code).toHaveLength(4);
      expect(code).toMatch(/^\d{4}$/);
    }
  });

  it("produces codes in range 1000-9999", () => {
    for (let i = 0; i < 100; i++) {
      const n = Number(makeRawCode());
      expect(n).toBeGreaterThanOrEqual(1000);
      expect(n).toBeLessThanOrEqual(9999);
    }
  });
});

