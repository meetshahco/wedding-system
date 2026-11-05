import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getDashboardStats,
  getGoLiveChecklist,
  getUsageReport,
  generateUsageCsv,
  getHealthCheck,
} from "@/lib/dashboard-service";
import { setSendingMethod } from "@/lib/sending-settings";

describe("Phase 10: Dashboard, Settings, Usage, and Health", () => {
  const createdWeddingIds: string[] = [];

  const createTestWedding = async (slugSuffix: string) => {
    const w = await prisma.wedding.create({
      data: {
        slug: `dash-${slugSuffix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        coupleName1: "Karan",
        coupleName2: "Natasha",
        weddingDate: new Date("2028-01-15"),
      },
    });
    createdWeddingIds.push(w.id);
    return w;
  };

  afterAll(async () => {
    if (createdWeddingIds.length > 0) {
      await prisma.wedding.deleteMany({ where: { id: { in: createdWeddingIds } } });
    }
  });

  it("calculates dashboard counts, opened metrics, and expected headcount per event correctly", async () => {
    const wedding = await createTestWedding("counts");
    await setSendingMethod(wedding.id, "mock");

    // Create 2 Events: Sangeet (VIP only) and Reception (All Events)
    const accessLevelVIP = await prisma.accessLevel.create({
      data: { weddingId: wedding.id, name: "VIP" },
    });

    const eventSangeet = await prisma.event.create({
      data: {
        weddingId: wedding.id,
        name: "Sangeet Night",
        date: new Date("2028-01-14"),
        startTime: "19:00",
        venue: "Palace Lawn",
        address: "Mumbai",
        sortOrder: 1,
      },
    });

    // Link Sangeet to VIP only
    await prisma.accessLevelEvent.create({
      data: {
        accessLevelId: accessLevelVIP.id,
        eventId: eventSangeet.id,
      },
    });

    const eventReception = await prisma.event.create({
      data: {
        weddingId: wedding.id,
        name: "Wedding Reception",
        date: new Date("2028-01-15"),
        startTime: "20:00",
        venue: "Grand Ballroom",
        address: "Mumbai",
        sortOrder: 2,
      },
    });
    // Reception has no access level restrictions -> all guests can attend

    const senderA = await prisma.sender.create({
      data: { weddingId: wedding.id, name: "Sender Vicky", accessToken: `tok-sv-${Date.now()}` },
    });

    // Guest 1: VIP, pax: 3, sent, opened (openCount: 2), assigned to Sender Vicky
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "VIP Family",
        phone: "+919876543111",
        pax: 3,
        code: "1111",
        token: `tok-d1-${Date.now()}`,
        accessLevelId: accessLevelVIP.id,
        senderId: senderA.id,
        inviteStatus: "sent",
        openCount: 2,
        viewedAt: new Date(),
      },
    });

    // Guest 2: General (no accessLevelId), pax: 2, sent, not opened (openCount: 0), assigned to Sender Vicky
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "General Couple",
        phone: "+919876543112",
        pax: 2,
        code: "1112",
        token: `tok-d2-${Date.now()}`,
        accessLevelId: null,
        senderId: senderA.id,
        inviteStatus: "sent",
        openCount: 0,
      },
    });

    // Guest 3: General (no accessLevelId), pax: 1, not_invited, not opened, unassigned sender
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Solo Friend",
        phone: "+919876543113",
        pax: 1,
        code: "1113",
        token: `tok-d3-${Date.now()}`,
        accessLevelId: null,
        senderId: null,
        inviteStatus: "not_invited",
        openCount: 0,
      },
    });

    const stats = await getDashboardStats(wedding.id);

    // 1. Overall stats
    expect(stats.totalGuests).toBe(3);
    expect(stats.totalPax).toBe(6); // 3 + 2 + 1
    expect(stats.sentGuests).toBe(2);
    expect(stats.sentPax).toBe(5); // 3 + 2
    expect(stats.openedGuests).toBe(1);
    expect(stats.openedPax).toBe(3);
    expect(stats.unassignedSenderGuests).toBe(1);

    // 2. Expected headcount per event
    const sangeetHeadcount = stats.eventsHeadcount.find((e) => e.id === eventSangeet.id);
    expect(sangeetHeadcount).toBeDefined();
    // Only VIP Guest (pax 3) and unassigned guests (Guest 2 & 3) if no tier or tier matching
    // Guest 1 has VIP tier -> attends (3 pax)
    // Guest 2 & 3 have accessLevelId = null (default tier: attends all events -> 2 + 1 pax)
    expect(sangeetHeadcount?.expectedPax).toBe(6);
    expect(sangeetHeadcount?.openedPax).toBe(3);

    const receptionHeadcount = stats.eventsHeadcount.find((e) => e.id === eventReception.id);
    expect(receptionHeadcount).toBeDefined();
    expect(receptionHeadcount?.expectedPax).toBe(6);

    // 3. Per-sender progress
    expect(stats.sendersProgress.length).toBe(1);
    expect(stats.sendersProgress[0].name).toBe("Sender Vicky");
    expect(stats.sendersProgress[0].totalAssigned).toBe(2);
    expect(stats.sendersProgress[0].sentCount).toBe(2);
    expect(stats.sendersProgress[0].pendingCount).toBe(0);
    expect(stats.sendersProgress[0].percentComplete).toBe(100);
  });

  it("calculates usage totals, category breakdowns, and exports formatted CSV", async () => {
    const wedding = await createTestWedding("usage-csv");

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Test Usage Guest",
        phone: "+919876543120",
        code: "1200",
        token: `tok-u-${Date.now()}`,
      },
    });

    // 2 Utility messages delivered
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: guest.id,
        kind: "template",
        templateKey: "invitation",
        status: "delivered",
        sentAt: new Date(),
      },
    });
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: guest.id,
        kind: "template",
        templateKey: "invitation",
        status: "sent",
        sentAt: new Date(),
      },
    });

    // 1 Marketing message delivered
    await prisma.messageTemplate.create({
      data: {
        weddingId: wedding.id,
        key: "promo_gift_registry",
        language: "en",
        category: "Marketing",
        body: "Check out our registry",
        buttons: "[]",
        sampleValues: "{}",
      },
    });
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: guest.id,
        kind: "template",
        templateKey: "promo_gift_registry",
        status: "delivered",
        sentAt: new Date(),
      },
    });

    // 1 Failed message (should NOT incur message cost)
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: guest.id,
        kind: "template",
        templateKey: "invitation",
        status: "failed",
        errorMessage: "Network timeout",
      },
    });

    // Custom rates: Utility = ₹0.50, Marketing = ₹1.20
    const report = await getUsageReport(wedding.id, {
      rates: { utility: 0.50, marketing: 1.20, currency: "INR" },
    });

    expect(report.totalMessages).toBe(4);
    expect(report.totalSent).toBe(1);
    expect(report.totalDelivered).toBe(2);
    expect(report.totalFailed).toBe(1);

    const utilityCategory = report.breakdownByCategory.find((c) => c.category.includes("Utility"));
    expect(utilityCategory?.count).toBe(2);
    expect(utilityCategory?.cost).toBe(1.00); // 2 * 0.50

    const marketingCategory = report.breakdownByCategory.find((c) => c.category.includes("Marketing"));
    expect(marketingCategory?.count).toBe(1);
    expect(marketingCategory?.cost).toBe(1.20); // 1 * 1.20

    expect(report.totalEstimatedCost).toBe(2.20); // 1.00 + 1.20

    // Test CSV generation
    const csv = await generateUsageCsv(wedding.id, {
      rates: { utility: 0.50, marketing: 1.20, currency: "INR" },
    });

    expect(csv).toContain("Timestamp,Guest Name,Phone,Template Key,Category,Status,Cost (INR)");
    expect(csv).toContain("Test Usage Guest");
    expect(csv).toContain("invitation");
    expect(csv).toContain("promo_gift_registry");
  });

  it("evaluates Go-Live checklist and health check diagnostic states accurately", async () => {
    const wedding = await createTestWedding("health-check");

    // 1. Checklist on fresh wedding
    const checklist = await getGoLiveChecklist(wedding.id);
    expect(checklist.overallReady).toBe(false); // No events, no guests, etc.
    const eventsCheck = checklist.items.find((i) => i.id === "events");
    expect(eventsCheck?.status).toBe("fail");

    // Add event and guest
    await prisma.event.create({
      data: {
        weddingId: wedding.id,
        name: "Main Wedding",
        date: new Date("2028-02-01"),
        startTime: "10:00",
        venue: "Hotel",
        address: "Goa",
      },
    });

    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Aman",
        phone: "+919876543130",
        code: "1300",
        token: `tok-h-${Date.now()}`,
      },
    });

    const updatedChecklist = await getGoLiveChecklist(wedding.id);
    const updatedEventsCheck = updatedChecklist.items.find((i) => i.id === "events");
    expect(updatedEventsCheck?.status).toBe("pass");

    // 2. System Health Check
    const health = await getHealthCheck(wedding.id);
    expect(health.database.status).toBe("ok");
    expect(health.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.jobQueue.queuedCount).toBe(0);
    expect(health.jobQueue.stalledCount).toBe(0);
    expect(health.status).toBe("HEALTHY");

    // 3. Test capped health state (simulate cap reached)
    await prisma.setting.upsert({
      where: { weddingId_key: { weddingId: wedding.id, key: "daily_send_cap" } },
      create: { weddingId: wedding.id, key: "daily_send_cap", value: "1" },
      update: { value: "1" },
    });

    // Send 1 message so sentToday = 1, remaining = 0
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: (await prisma.guest.findFirst({ where: { weddingId: wedding.id } }))!.id,
        kind: "template",
        templateKey: "invitation",
        status: "sent",
        sentAt: new Date(),
      },
    });

    const cappedHealth = await getHealthCheck(wedding.id);
    expect(cappedHealth.dailyCap.remaining).toBe(0);
    expect(cappedHealth.dailyCap.status).toBe("capped");
    expect(cappedHealth.status).toBe("DEGRADED");
  });
});
