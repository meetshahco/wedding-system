import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getInviteUrl } from "@/lib/url-builder";
import crypto from "crypto";

describe("Phase 3A: Multi-Wedding Foundation & Isolation", () => {
  let weddingAId: string;
  let weddingBId: string;

  beforeAll(async () => {
    // Create two test weddings
    const weddingA = await prisma.wedding.create({
      data: {
        slug: `test-wedding-a-${Date.now()}`,
        coupleName1: "Alice",
        coupleName2: "Bob",
        weddingDate: new Date("2027-05-10"),
        accentColor: "#111111",
      },
    });
    weddingAId = weddingA.id;

    const weddingB = await prisma.wedding.create({
      data: {
        slug: `test-wedding-b-${Date.now()}`,
        coupleName1: "Charlie",
        coupleName2: "Diana",
        weddingDate: new Date("2027-06-20"),
        accentColor: "#222222",
      },
    });
    weddingBId = weddingB.id;
  });

  afterAll(async () => {
    // Cleanup test weddings and cascade data
    if (weddingAId) await prisma.wedding.delete({ where: { id: weddingAId } }).catch(() => {});
    if (weddingBId) await prisma.wedding.delete({ where: { id: weddingBId } }).catch(() => {});
  });

  it("ensures guests from Wedding A are NEVER returned for Wedding B", async () => {
    // Add guest in Wedding A
    const guestA = await prisma.guest.create({
      data: {
        weddingId: weddingAId,
        name: "Guest Alpha",
        phone: "+919111111111",
        pax: 2,
        token: crypto.randomBytes(8).toString("base64url").slice(0, 10),
        code: "1111",
      },
    });

    // Add guest in Wedding B
    const guestB = await prisma.guest.create({
      data: {
        weddingId: weddingBId,
        name: "Guest Beta",
        phone: "+919222222222",
        pax: 3,
        token: crypto.randomBytes(8).toString("base64url").slice(0, 10),
        code: "2222",
      },
    });

    // Query Wedding A
    const weddingAGuests = await prisma.guest.findMany({
      where: { weddingId: weddingAId },
    });
    expect(weddingAGuests.some((g) => g.id === guestA.id)).toBe(true);
    expect(weddingAGuests.some((g) => g.id === guestB.id)).toBe(false);

    // Query Wedding B
    const weddingBGuests = await prisma.guest.findMany({
      where: { weddingId: weddingBId },
    });
    expect(weddingBGuests.some((g) => g.id === guestB.id)).toBe(true);
    expect(weddingBGuests.some((g) => g.id === guestA.id)).toBe(false);
  });

  it("allows identical phone numbers and codes across different weddings, but enforces uniqueness within the same wedding", async () => {
    const sharedPhone = "+919999999999";
    const sharedCode = "7777";

    // Create in Wedding A
    const gA = await prisma.guest.create({
      data: {
        weddingId: weddingAId,
        name: "Shared Phone User A",
        phone: sharedPhone,
        code: sharedCode,
        token: crypto.randomBytes(8).toString("base64url").slice(0, 10),
      },
    });
    expect(gA.phone).toBe(sharedPhone);

    // Same phone and code should succeed in Wedding B
    const gB = await prisma.guest.create({
      data: {
        weddingId: weddingBId,
        name: "Shared Phone User B",
        phone: sharedPhone,
        code: sharedCode,
        token: crypto.randomBytes(8).toString("base64url").slice(0, 10),
      },
    });
    expect(gB.phone).toBe(sharedPhone);

    // Attempting duplicate phone in Wedding A MUST throw unique constraint violation
    await expect(
      prisma.guest.create({
        data: {
          weddingId: weddingAId,
          name: "Duplicate Phone in Wedding A",
          phone: sharedPhone,
          code: "8888",
          token: crypto.randomBytes(8).toString("base64url").slice(0, 10),
        },
      })
    ).rejects.toThrow();

    // Attempting duplicate code in Wedding A MUST throw unique constraint violation
    await expect(
      prisma.guest.create({
        data: {
          weddingId: weddingAId,
          name: "Duplicate Code in Wedding A",
          phone: "+919888888888",
          code: sharedCode,
          token: crypto.randomBytes(8).toString("base64url").slice(0, 10),
        },
      })
    ).rejects.toThrow();
  });

  it("enforces that token is globally unique across all weddings", async () => {
    const globalToken = "tokglobal1";

    await prisma.guest.create({
      data: {
        weddingId: weddingAId,
        name: "Token User A",
        phone: "+919777777771",
        code: "3331",
        token: globalToken,
      },
    });

    // Attempting to reuse the same token in Wedding B must fail
    await expect(
      prisma.guest.create({
        data: {
          weddingId: weddingBId,
          name: "Token User B",
          phone: "+919777777772",
          code: "3332",
          token: globalToken,
        },
      })
    ).rejects.toThrow();
  });

  it("builds centralised invite links via getInviteUrl", () => {
    const urlDefault = getInviteUrl({ token: "abc123token" }, undefined, "https://weddings.app");
    expect(urlDefault).toBe("https://weddings.app/i/abc123token");

    const urlCustomDomain = getInviteUrl(
      { token: "abc123token" },
      { primaryDomain: "arjunandmeera.com" },
      "https://weddings.app"
    );
    expect(urlCustomDomain).toBe("https://arjunandmeera.com/i/abc123token");
  });

  it("confirms that RSVP models, tables, and APIs are completely absent", () => {
    // In Prisma client, prisma.rsvp should be completely undefined
    const untypedPrisma = prisma as unknown as Record<string, unknown>;
    expect(untypedPrisma.rsvp).toBeUndefined();
    expect(untypedPrisma.rsvpStatus).toBeUndefined();
  });
});
