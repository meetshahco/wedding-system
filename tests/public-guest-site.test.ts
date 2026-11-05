import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { generateIcs } from "@/lib/calendar";

describe("Phase 5: Public Guest Site (no RSVP)", () => {
  let weddingAId: string;
  let weddingBId: string;
  let event1Id: string;
  let event2Id: string;
  let event3Id: string;
  let guestA1Token: string;
  let guestA2Token: string;
  let guestB1Token: string;

  beforeAll(async () => {
    // 1. Create two test weddings
    const weddingA = await prisma.wedding.create({
      data: {
        slug: `public-site-a-${Date.now()}`,
        coupleName1: "Mira",
        coupleName2: "Kabir",
        weddingDate: new Date("2027-05-20"),
      },
    });
    weddingAId = weddingA.id;

    const weddingB = await prisma.wedding.create({
      data: {
        slug: `public-site-b-${Date.now()}`,
        coupleName1: "Neha",
        coupleName2: "Rishi",
        weddingDate: new Date("2027-06-15"),
      },
    });
    weddingBId = weddingB.id;

    // 2. Create Events for Wedding A
    const e1 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Mehendi Ceremony",
        date: new Date("2027-05-18"),
        startTime: "4:00 PM",
        venue: "Garden Pavilion",
        address: "100 Grand Ave",
        sortOrder: 1,
      },
    });
    event1Id = e1.id;

    const e2 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Sangeet Night",
        date: new Date("2027-05-19"),
        startTime: "7:00 PM",
        venue: "Crystal Ballroom",
        address: "100 Grand Ave",
        sortOrder: 2,
      },
    });
    event2Id = e2.id;

    const e3 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Wedding & Reception",
        date: new Date("2027-05-20"),
        startTime: "11:00 AM",
        venue: "Main Mandap",
        address: "100 Grand Ave",
        sortOrder: 3,
      },
    });
    event3Id = e3.id;

    // 3. Create Access Levels for Wedding A
    const alReceptionOnly = await prisma.accessLevel.create({
      data: {
        weddingId: weddingAId,
        name: "Reception Only",
        events: {
          create: [{ eventId: e3.id }],
        },
      },
    });

    const alAllEvents = await prisma.accessLevel.create({
      data: {
        weddingId: weddingAId,
        name: "All Events",
        events: {
          create: [{ eventId: e1.id }, { eventId: e2.id }, { eventId: e3.id }],
        },
      },
    });

    // 4. Create Guests for Wedding A
    const gA1 = await prisma.guest.create({
      data: {
        weddingId: weddingAId,
        name: "Anil Kapoor",
        phone: "+919111111111",
        code: "7777",
        token: `tok-a1-${Date.now()}`,
        accessLevelId: alReceptionOnly.id,
      },
    });
    guestA1Token = gA1.token;

    const gA2 = await prisma.guest.create({
      data: {
        weddingId: weddingAId,
        name: "Sunita Kapoor",
        phone: "+919222222222",
        code: "8888",
        token: `tok-a2-${Date.now()}`,
        accessLevelId: alAllEvents.id,
      },
    });
    guestA2Token = gA2.token;

    // 5. Create Guest for Wedding B with identical code "7777"
    const gB1 = await prisma.guest.create({
      data: {
        weddingId: weddingBId,
        name: "Rajesh Sharma",
        phone: "+919333333333",
        code: "7777", // Same 4-digit code allowed across weddings
        token: `tok-b1-${Date.now()}`,
      },
    });
    guestB1Token = gB1.token;
  });

  afterAll(async () => {
    await prisma.wedding.deleteMany({
      where: { id: { in: [weddingAId, weddingBId] } },
    });
  });

  it("filters events strictly by the guest's access level", async () => {
    // Guest A1 has 'Reception Only' access level (only Event 3)
    const guest1 = await prisma.guest.findUnique({
      where: { token: guestA1Token },
      include: {
        accessLevel: {
          include: {
            events: {
              include: { event: true },
            },
          },
        },
      },
    });

    expect(guest1).not.toBeNull();
    const guest1Events = guest1?.accessLevel?.events.map((e) => e.event) || [];
    expect(guest1Events.length).toBe(1);
    expect(guest1Events[0].id).toBe(event3Id);
    expect(guest1Events[0].name).toBe("Wedding & Reception");

    // Guest A2 has 'All Events' access level (Event 1, 2, 3)
    const guest2 = await prisma.guest.findUnique({
      where: { token: guestA2Token },
      include: {
        accessLevel: {
          include: {
            events: {
              include: { event: true },
            },
          },
        },
      },
    });

    expect(guest2).not.toBeNull();
    const guest2Events = guest2?.accessLevel?.events.map((e) => e.event) || [];
    expect(guest2Events.length).toBe(3);
    const eventIds = guest2Events.map((e) => e.id);
    expect(eventIds).toContain(event1Id);
    expect(eventIds).toContain(event2Id);
    expect(eventIds).toContain(event3Id);
  });

  it("resolves code lookup per wedding correctly", async () => {
    // Lookup code '7777' in Wedding A -> resolves Guest A1
    const matchA = await prisma.guest.findFirst({
      where: { weddingId: weddingAId, code: "7777" },
    });
    expect(matchA?.token).toBe(guestA1Token);
    expect(matchA?.name).toBe("Anil Kapoor");

    // Lookup code '7777' in Wedding B -> resolves Guest B1
    const matchB = await prisma.guest.findFirst({
      where: { weddingId: weddingBId, code: "7777" },
    });
    expect(matchB?.token).toBe(guestB1Token);
    expect(matchB?.name).toBe("Rajesh Sharma");

    // Invalid code in Wedding A
    const matchInvalid = await prisma.guest.findFirst({
      where: { weddingId: weddingAId, code: "9999" },
    });
    expect(matchInvalid).toBeNull();
  });

  it("enforces database-backed rate limiting per IP and wedding", async () => {
    const testIp = `test-ip-${Date.now()}`;
    const windowMs = 60 * 1000;
    const limit = 5;

    // First 5 attempts within window should be allowed
    for (let i = 1; i <= limit; i++) {
      const res = await checkRateLimit(`${weddingAId}:${testIp}`, "code_entry", limit, windowMs);
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - i);
    }

    // 6th attempt should be blocked
    const blockedRes = await checkRateLimit(
      `${weddingAId}:${testIp}`,
      "code_entry",
      limit,
      windowMs
    );
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);

    // Another IP or different wedding should NOT be blocked
    const otherWeddingRes = await checkRateLimit(
      `${weddingBId}:${testIp}`,
      "code_entry",
      limit,
      windowMs
    );
    expect(otherWeddingRes.allowed).toBe(true);
  });

  it("generates RFC 5545 compliant .ics calendar output", () => {
    const ics = generateIcs({
      id: "ev-test-123",
      name: "Sangeet & Cocktail Night",
      date: new Date("2027-05-19T00:00:00Z"),
      startTime: "7:30 PM",
      venue: "Crystal Ballroom",
      address: "100 Grand Ave, Suite 2",
      description: "Music, performances, and dinner.",
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Sangeet & Cocktail Night");
    expect(ics).toContain("LOCATION:Crystal Ballroom\\, 100 Grand Ave\\, Suite 2");
    expect(ics).toContain("DESCRIPTION:Music\\, performances\\, and dinner.");
    expect(ics).toContain("DTSTART:");
    expect(ics).toContain("DTEND:");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("tracks first and repeat opens accurately", async () => {
    const guest = await prisma.guest.findUnique({
      where: { token: guestA1Token },
    });
    expect(guest?.viewedAt).toBeNull();
    expect(guest?.openCount).toBe(0);

    // First open
    const firstTime = new Date("2027-04-01T12:00:00Z");
    const afterFirstOpen = await prisma.guest.update({
      where: { token: guestA1Token },
      data: {
        viewedAt: firstTime,
        lastViewedAt: firstTime,
        openCount: { increment: 1 },
      },
    });

    expect(afterFirstOpen.viewedAt?.toISOString()).toBe(firstTime.toISOString());
    expect(afterFirstOpen.lastViewedAt?.toISOString()).toBe(firstTime.toISOString());
    expect(afterFirstOpen.openCount).toBe(1);

    // Repeat open (second time)
    const secondTime = new Date("2027-04-02T15:30:00Z");
    const afterSecondOpen = await prisma.guest.update({
      where: { token: guestA1Token },
      data: {
        lastViewedAt: secondTime,
        openCount: { increment: 1 },
      },
    });

    // viewedAt must remain the initial open time
    expect(afterSecondOpen.viewedAt?.toISOString()).toBe(firstTime.toISOString());
    expect(afterSecondOpen.lastViewedAt?.toISOString()).toBe(secondTime.toISOString());
    expect(afterSecondOpen.openCount).toBe(2);
  });

  it("returns null safely for invalid or non-existent tokens without errors", async () => {
    const result = await prisma.guest.findUnique({
      where: { token: "non-existent-token-xyz" },
      include: { wedding: true, accessLevel: true },
    });

    expect(result).toBeNull();
  });
});

