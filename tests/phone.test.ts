import { describe, it, expect } from "vitest";
import { normalisePhone, isE164, toMetaFormat } from "@/lib/phone";

describe("normalisePhone", () => {
  it("normalises a 10-digit Indian number to E.164", () => {
    expect(normalisePhone("9876543210")).toBe("+919876543210");
  });

  it("normalises a number already with +91", () => {
    expect(normalisePhone("+919876543210")).toBe("+919876543210");
  });

  it("normalises a number with spaces and dashes", () => {
    expect(normalisePhone("98765 43210")).toBe("+919876543210");
  });

  it("handles international numbers with country code", () => {
    expect(normalisePhone("+14155552671")).toBe("+14155552671");
  });

  it("returns null for an invalid number", () => {
    expect(normalisePhone("123")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalisePhone("")).toBeNull();
  });

  it("returns null for obviously fake number", () => {
    expect(normalisePhone("00000000000")).toBeNull();
  });
});

describe("isE164", () => {
  it("returns true for valid E.164", () => {
    expect(isE164("+919876543210")).toBe(true);
    expect(isE164("+14155552671")).toBe(true);
  });

  it("returns false for missing leading +", () => {
    expect(isE164("919876543210")).toBe(false);
  });

  it("returns false for too short", () => {
    expect(isE164("+12345")).toBe(false);
  });
});

describe("toMetaFormat", () => {
  it("strips the leading + sign", () => {
    expect(toMetaFormat("+919876543210")).toBe("919876543210");
  });
});

