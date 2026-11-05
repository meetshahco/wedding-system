import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

describe("Phase 4: Events and Access Levels (per wedding)", () => {
  let weddingAId: string;
  let weddingBId: string;

  beforeAll(async () => {
    // 1. Create two test weddings
    const weddingA = await prisma.wedding.create({
      data: {
        slug: `event-test-a-${Date.now()}`,
        coupleName1: "Karan",
        coupleName2: "Ananya",
        weddingDate: new Date("2027-11-10"),
      },
    });
    weddingAId = weddingA.id;

    const weddingB = await prisma.wedding.create({
      data: {
        slug: `event-test-b-${Date.now()}`,
        coupleName1: "Vikram",
        coupleName2: "Pooja",
        weddingDate: new Date("2027-12-05"),
      },
    });
    weddingBId = weddingB.id;
  });

  afterAll(async () => {
    await prisma.wedding.deleteMany({
      where: { id: { in: [weddingAId, weddingBId] } },
    });
  });

  it("enforces strict wedding scoping for events and access levels", async () => {
    // Create event in Wedding A
    const eventA = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Wedding A Ceremony",
        date: new Date("2027-11-10T10:00:00Z"),
        startTime: "10:00 AM",
        venue: "Palace A",
        address: "Address A",
        sortOrder: 1,
      },
    });

    // Create event in Wedding B
    const eventB = await prisma.event.create({
      data: {
        weddingId: weddingBId,
        name: "Wedding B Sangeet",
        date: new Date("2027-12-05T19:00:00Z"),
        startTime: "7:00 PM",
        venue: "Palace B",
        address: "Address B",
        sortOrder: 1,
      },
    });

    // Query events for Wedding A
    const eventsA = await prisma.event.findMany({
      where: { weddingId: weddingAId },
    });
    expect(eventsA.length).toBe(1);
    expect(eventsA[0].id).toBe(eventA.id);
    expect(eventsA[0].name).toBe("Wedding A Ceremony");

    // Query events for Wedding B
    const eventsB = await prisma.event.findMany({
      where: { weddingId: weddingBId },
    });
    expect(eventsB.length).toBe(1);
    expect(eventsB[0].id).toBe(eventB.id);
    expect(eventsB[0].name).toBe("Wedding B Sangeet");

    // Create Access Levels for Wedding A & Wedding B
    const alA = await prisma.accessLevel.create({
      data: {
        weddingId: weddingAId,
        name: "VIP Family",
      },
    });

    const alB = await prisma.accessLevel.create({
      data: {
        weddingId: weddingBId,
        name: "VIP Family", // Same name allowed across different weddings
      },
    });

    const alsForA = await prisma.accessLevel.findMany({
      where: { weddingId: weddingAId },
    });
    expect(alsForA.length).toBe(1);
    expect(alsForA[0].id).toBe(alA.id);

    const alsForB = await prisma.accessLevel.findMany({
      where: { weddingId: weddingBId },
    });
    expect(alsForB.length).toBe(1);
    expect(alsForB[0].id).toBe(alB.id);

    // Enforce uniqueness within the same wedding (duplicate name in Wedding A should throw)
    await expect(
      prisma.accessLevel.create({
        data: {
          weddingId: weddingAId,
          name: "VIP Family",
        },
      })
    ).rejects.toThrow();
  });

  it("links access levels to multiple events and queries them correctly", async () => {
    // Create 3 events for Wedding A
    const e1 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Haldi",
        date: new Date("2027-11-09"),
        startTime: "9:00 AM",
        venue: "Poolside",
        address: "Resort A",
        sortOrder: 1,
      },
    });

    const e2 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Sangeet",
        date: new Date("2027-11-09"),
        startTime: "7:00 PM",
        venue: "Grand Ballroom",
        address: "Resort A",
        sortOrder: 2,
      },
    });

    const e3 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Reception",
        date: new Date("2027-11-10"),
        startTime: "8:00 PM",
        venue: "Lawn",
        address: "Resort A",
        sortOrder: 3,
      },
    });

    // Create Access Level "Full Celebration" linking all 3
    const alFull = await prisma.accessLevel.create({
      data: {
        weddingId: weddingAId,
        name: "Full Celebration",
        events: {
          create: [{ eventId: e1.id }, { eventId: e2.id }, { eventId: e3.id }],
        },
      },
      include: {
        events: {
          include: { event: true },
        },
      },
    });

    expect(alFull.events.length).toBe(3);
    const eventNames = alFull.events.map((link) => link.event.name).sort();
    expect(eventNames).toEqual(["Haldi", "Reception", "Sangeet"]);

    // Update access level to only link Reception
    await prisma.accessLevelEvent.deleteMany({
      where: { accessLevelId: alFull.id },
    });
    await prisma.accessLevelEvent.create({
      data: {
        accessLevelId: alFull.id,
        eventId: e3.id,
      },
    });

    const updated = await prisma.accessLevel.findUnique({
      where: { id: alFull.id },
      include: {
        events: { include: { event: true } },
      },
    });
    expect(updated?.events.length).toBe(1);
    expect(updated?.events[0].event.name).toBe("Reception");
  });

  it("handles deleting an event used by an access level safely without breaking the access level", async () => {
    // Create two events
    const eDel1 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Welcome Dinner",
        date: new Date("2027-11-08"),
        startTime: "6:00 PM",
        venue: "Terrace",
        address: "Resort A",
      },
    });

    const eDel2 = await prisma.event.create({
      data: {
        weddingId: weddingAId,
        name: "Farewell Brunch",
        date: new Date("2027-11-11"),
        startTime: "11:00 AM",
        venue: "Café",
        address: "Resort A",
      },
    });

    // Create Access Level linking both
    const alShared = await prisma.accessLevel.create({
      data: {
        weddingId: weddingAId,
        name: "Special Guests",
        events: {
          create: [{ eventId: eDel1.id }, { eventId: eDel2.id }],
        },
      },
    });

    // Verify initial count of 2 linked events
    const linksBefore = await prisma.accessLevelEvent.findMany({
      where: { accessLevelId: alShared.id },
    });
    expect(linksBefore.length).toBe(2);

    // Delete eDel1 (Welcome Dinner)
    await prisma.event.delete({
      where: { id: eDel1.id },
    });

    // Verify eDel1 is gone
    const checkDeleted = await prisma.event.findUnique({
      where: { id: eDel1.id },
    });
    expect(checkDeleted).toBeNull();

    // Verify Access Level STILL exists and has exactly 1 linked event left (Farewell Brunch)
    const alAfter = await prisma.accessLevel.findUnique({
      where: { id: alShared.id },
      include: {
        events: { include: { event: true } },
      },
    });
    expect(alAfter).not.toBeNull();
    expect(alAfter?.events.length).toBe(1);
    expect(alAfter?.events[0].eventId).toBe(eDel2.id);
    expect(alAfter?.events[0].event.name).toBe("Farewell Brunch");
  });

  it("handles deleting an access level assigned to guests safely (sets guest accessLevelId to null)", async () => {
    // Create an access level
    const alForGuest = await prisma.accessLevel.create({
      data: {
        weddingId: weddingAId,
        name: "Temporary Tier",
      },
    });

    // Create a guest with this access level
    const guest = await prisma.guest.create({
      data: {
        weddingId: weddingAId,
        name: "Suresh Gupta",
        phone: "+919876543210",
        pax: 2,
        code: "1234",
        token: "tok1234567",
        accessLevelId: alForGuest.id,
      },
    });

    expect(guest.accessLevelId).toBe(alForGuest.id);

    // Delete the access level
    await prisma.accessLevel.delete({
      where: { id: alForGuest.id },
    });

    // Verify guest still exists and accessLevelId is now null
    const updatedGuest = await prisma.guest.findUnique({
      where: { id: guest.id },
    });
    expect(updatedGuest).not.toBeNull();
    expect(updatedGuest?.accessLevelId).toBeNull();
    expect(updatedGuest?.name).toBe("Suresh Gupta");
  });

  it("seeds start-from-template default events and access levels correctly", async () => {
    const weddingC = await prisma.wedding.create({
      data: {
        slug: `template-test-${Date.now()}`,
        coupleName1: "Dev",
        coupleName2: "Riya",
        weddingDate: new Date("2027-10-15"),
      },
    });

    const wDate = new Date(weddingC.weddingDate);

    // Seed events as standard template does
    const e1 = await prisma.event.create({
      data: {
        weddingId: weddingC.id,
        name: "Mehendi Ceremony",
        date: new Date(wDate.getTime() - 2 * 24 * 60 * 60 * 1000),
        startTime: "4:00 PM",
        venue: "Garden Pavilion",
        address: "Royal Estate",
        sortOrder: 1,
      },
    });

    const e2 = await prisma.event.create({
      data: {
        weddingId: weddingC.id,
        name: "Sangeet Night",
        date: new Date(wDate.getTime() - 1 * 24 * 60 * 60 * 1000),
        startTime: "7:00 PM",
        venue: "Grand Ballroom",
        address: "Royal Estate",
        sortOrder: 2,
      },
    });

    const e3 = await prisma.event.create({
      data: {
        weddingId: weddingC.id,
        name: "Wedding Ceremony",
        date: wDate,
        startTime: "10:00 AM",
        venue: "Temple Courtyard",
        address: "Royal Estate",
        sortOrder: 3,
      },
    });

    const e4 = await prisma.event.create({
      data: {
        weddingId: weddingC.id,
        name: "Reception Dinner",
        date: wDate,
        startTime: "7:30 PM",
        venue: "Royal Palace Hall",
        address: "Royal Estate",
        sortOrder: 4,
      },
    });

    // Create 3 access levels
    const alAll = await prisma.accessLevel.create({
      data: {
        weddingId: weddingC.id,
        name: "All Events",
        events: {
          create: [{ eventId: e1.id }, { eventId: e2.id }, { eventId: e3.id }, { eventId: e4.id }],
        },
      },
      include: { events: true },
    });

    const alWeddingReception = await prisma.accessLevel.create({
      data: {
        weddingId: weddingC.id,
        name: "Wedding & Reception",
        events: {
          create: [{ eventId: e3.id }, { eventId: e4.id }],
        },
      },
      include: { events: true },
    });

    const alReceptionOnly = await prisma.accessLevel.create({
      data: {
        weddingId: weddingC.id,
        name: "Reception Only",
        events: {
          create: [{ eventId: e4.id }],
        },
      },
      include: { events: true },
    });

    expect(alAll.events.length).toBe(4);
    expect(alWeddingReception.events.length).toBe(2);
    expect(alReceptionOnly.events.length).toBe(1);

    // Clean up
    await prisma.wedding.delete({ where: { id: weddingC.id } });
  });
});

