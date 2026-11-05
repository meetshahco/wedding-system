import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  queueInvitations,
  bulkAssignGuests,
  getInvitationSummary,
  getInvitationProgress,
} from "@/lib/invitation-service";
import { setSendingMethod } from "@/lib/sending-settings";
import { hashPassword } from "@/lib/crypto-passwords";

describe("Phase 8: Invitations Screen & Sending Workflows", () => {
  const createdWeddingIds: string[] = [];
  const createdUserIds: string[] = [];

  const createTestWedding = async (slugSuffix: string) => {
    const w = await prisma.wedding.create({
      data: {
        slug: `inv-${slugSuffix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        coupleName1: "Rohan",
        coupleName2: "Ananya",
        weddingDate: new Date("2027-12-10"),
      },
    });
    createdWeddingIds.push(w.id);
    return w;
  };

  const createTestUser = async (email: string, globalRole: "OWNER" | "MANAGER" | "USER") => {
    const u = await prisma.user.create({
      data: {
        email: `${Date.now()}-${email}`,
        name: `Test ${globalRole}`,
        passwordHash: hashPassword("Password123!"),
        globalRole,
      },
    });
    createdUserIds.push(u.id);
    return u;
  };

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdWeddingIds.length > 0) {
      await prisma.wedding.deleteMany({ where: { id: { in: createdWeddingIds } } });
    }
  });

  it("only queues eligible guests (has phone, not opted out, uninvited)", async () => {
    const wedding = await createTestWedding("eligibility");
    await setSendingMethod(wedding.id, "mock");

    // Eligible guest: valid phone, not opted out, not_invited
    const eligibleGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Eligible Guest",
        phone: "+919876543210",
        code: "1001",
        token: `tok-el-${Date.now()}-1`,
        inviteStatus: "not_invited",
        optedOut: false,
      },
    });

    // Ineligible guest 1: empty phone
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "No Phone Guest",
        phone: "",
        code: "1002",
        token: `tok-el-${Date.now()}-2`,
        inviteStatus: "not_invited",
        optedOut: false,
      },
    });

    // Ineligible guest 2: opted out
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Opted Out Guest",
        phone: "+919876543211",
        code: "1003",
        token: `tok-el-${Date.now()}-3`,
        inviteStatus: "not_invited",
        optedOut: true,
      },
    });

    // Ineligible guest 3: already invited
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Already Sent Guest",
        phone: "+919876543212",
        code: "1004",
        token: `tok-el-${Date.now()}-4`,
        inviteStatus: "sent",
        optedOut: false,
      },
    });

    const result = await queueInvitations(wedding.id);
    expect(result.success).toBe(true);
    expect(result.queuedCount).toBe(1);

    // Verify only the eligible guest was updated to queued in DB
    const updatedEligible = await prisma.guest.findUnique({
      where: { id: eligibleGuest.id },
    });
    expect(updatedEligible?.inviteStatus).toBe("queued");

    const messageLogs = await prisma.messageLog.findMany({
      where: { weddingId: wedding.id },
    });
    expect(messageLogs.length).toBe(1);
    expect(messageLogs[0].guestId).toBe(eligibleGuest.id);
    expect(messageLogs[0].status).toBe("queued");
  });

  it("strictly prevents double sends even on subsequent queue requests", async () => {
    const wedding = await createTestWedding("no-double");
    await setSendingMethod(wedding.id, "mock");

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Single Send Guest",
        phone: "+919876543220",
        code: "2001",
        token: `tok-ds-${Date.now()}`,
        inviteStatus: "not_invited",
      },
    });

    // First queue
    const firstRun = await queueInvitations(wedding.id);
    expect(firstRun.success).toBe(true);
    expect(firstRun.queuedCount).toBe(1);

    // Second queue attempt immediately after
    const secondRun = await queueInvitations(wedding.id);
    expect(secondRun.success).toBe(true);
    expect(secondRun.queuedCount).toBe(0);
    expect(secondRun.skippedCount).toBe(0); // not in candidate list because status is now queued

    // Now simulate that the message was delivered
    await prisma.messageLog.updateMany({
      where: { weddingId: wedding.id, guestId: guest.id },
      data: { status: "delivered" },
    });
    await prisma.guest.update({
      where: { id: guest.id },
      data: { inviteStatus: "delivered" },
    });

    // Third queue attempt targeting this guest explicitly
    const targetedRun = await queueInvitations(wedding.id, { guestIds: [guest.id] });
    expect(targetedRun.success).toBe(true);
    expect(targetedRun.queuedCount).toBe(0);
    expect(targetedRun.skippedCount).toBe(0);

    // Verify total message logs remains exactly 1
    const totalLogs = await prisma.messageLog.count({
      where: { weddingId: wedding.id, guestId: guest.id },
    });
    expect(totalLogs).toBe(1);
  });

  it("retries failed invitations safely without touching delivered or pending messages", async () => {
    const wedding = await createTestWedding("retry-failed");
    await setSendingMethod(wedding.id, "mock");

    // Guest A: failed
    const failedGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Failed Guest",
        phone: "+919876543231",
        code: "3001",
        token: `tok-rf-${Date.now()}-1`,
        inviteStatus: "failed",
      },
    });
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: failedGuest.id,
        kind: "template",
        templateKey: "invitation",
        status: "failed",
        errorMessage: "Network timeout simulation",
        attempts: 3,
      },
    });

    // Guest B: delivered
    const deliveredGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Delivered Guest",
        phone: "+919876543232",
        code: "3002",
        token: `tok-rf-${Date.now()}-2`,
        inviteStatus: "delivered",
      },
    });
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: deliveredGuest.id,
        kind: "template",
        templateKey: "invitation",
        status: "delivered",
        sentAt: new Date(),
      },
    });

    // Execute retry failed
    const retryResult = await queueInvitations(wedding.id, { retryFailed: true });
    expect(retryResult.success).toBe(true);
    expect(retryResult.queuedCount).toBe(1);

    // Verify failed guest is now queued and attempts reset
    const refreshedFailedGuest = await prisma.guest.findUnique({
      where: { id: failedGuest.id },
    });
    expect(refreshedFailedGuest?.inviteStatus).toBe("queued");

    const failedLog = await prisma.messageLog.findFirst({
      where: { weddingId: wedding.id, guestId: failedGuest.id },
    });
    expect(failedLog?.status).toBe("queued");
    expect(failedLog?.attempts).toBe(0);
    expect(failedLog?.errorMessage).toBeNull();

    // Verify delivered guest was NOT affected
    const refreshedDeliveredGuest = await prisma.guest.findUnique({
      where: { id: deliveredGuest.id },
    });
    expect(refreshedDeliveredGuest?.inviteStatus).toBe("delivered");

    const deliveredLog = await prisma.messageLog.findFirst({
      where: { weddingId: wedding.id, guestId: deliveredGuest.id },
    });
    expect(deliveredLog?.status).toBe("delivered");
  });

  it("handles manual mode versus API sending mode correctly", async () => {
    const wedding = await createTestWedding("manual-vs-api");

    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Manual Mode Test Guest",
        phone: "+919876543240",
        code: "4001",
        token: `tok-mva-${Date.now()}`,
        inviteStatus: "not_invited",
      },
    });

    // 1. Set to manual mode
    await setSendingMethod(wedding.id, "manual");

    // Attempting API queue should return MANUAL_MODE_ACTIVE error
    const manualResult = await queueInvitations(wedding.id);
    expect(manualResult.success).toBe(false);
    expect(manualResult.error).toBe("MANUAL_MODE_ACTIVE");

    // Verify guest was not modified
    const guestStillNotInvited = await prisma.guest.findFirst({
      where: { weddingId: wedding.id },
    });
    expect(guestStillNotInvited?.inviteStatus).toBe("not_invited");

    // 2. Switch to mock API mode
    await setSendingMethod(wedding.id, "mock");
    const apiResult = await queueInvitations(wedding.id);
    expect(apiResult.success).toBe(true);
    expect(apiResult.queuedCount).toBe(1);

    const guestNowQueued = await prisma.guest.findFirst({
      where: { weddingId: wedding.id },
    });
    expect(guestNowQueued?.inviteStatus).toBe("queued");
  });

  it("enforces rolling daily send caps when batch-queueing invitations", async () => {
    const wedding = await createTestWedding("daily-caps");
    await setSendingMethod(wedding.id, "mock");

    // Set daily cap to 2 messages
    await prisma.setting.upsert({
      where: { weddingId_key: { weddingId: wedding.id, key: "daily_send_cap" } },
      create: { weddingId: wedding.id, key: "daily_send_cap", value: "2" },
      update: { value: "2" },
    });

    // Create 4 eligible guests
    for (let i = 0; i < 4; i++) {
      await prisma.guest.create({
        data: {
          weddingId: wedding.id,
          name: `Cap Guest ${i + 1}`,
          phone: `+91987654325${i}`,
          code: `500${i}`,
          token: `tok-cap-${Date.now()}-${i}`,
          inviteStatus: "not_invited",
        },
      });
    }

    // First queue run: only 2 can be queued due to daily cap
    const firstRun = await queueInvitations(wedding.id);
    expect(firstRun.success).toBe(true);
    expect(firstRun.queuedCount).toBe(2);
    expect(firstRun.remainingCap).toBe(0);

    // Fake sending the first 2 so they count toward the sent cap
    await prisma.messageLog.updateMany({
      where: { weddingId: wedding.id, status: "queued" },
      data: { status: "sent", sentAt: new Date() },
    });

    // Next queue run: cap is now reached (2/2 sent today)
    const secondRun = await queueInvitations(wedding.id);
    expect(secondRun.success).toBe(false);
    expect(secondRun.error).toBe("DAILY_CAP_REACHED");
  });

  it("bulk assigns access level and sender scoped strictly to the wedding", async () => {
    const weddingA = await createTestWedding("bulk-a");
    const weddingB = await createTestWedding("bulk-b");

    // Create access levels and senders in wedding A
    const accessLevelA = await prisma.accessLevel.create({
      data: { weddingId: weddingA.id, name: "VIP Reception" },
    });
    const senderA = await prisma.sender.create({
      data: { weddingId: weddingA.id, name: "Groom's Brother", accessToken: `tok-s-${Date.now()}` },
    });

    // Create guests in wedding A
    const guestA1 = await prisma.guest.create({
      data: {
        weddingId: weddingA.id,
        name: "Guest A1",
        phone: "+919876543261",
        code: "6001",
        token: `tok-ba-${Date.now()}-1`,
      },
    });
    const guestA2 = await prisma.guest.create({
      data: {
        weddingId: weddingA.id,
        name: "Guest A2",
        phone: "+919876543262",
        code: "6002",
        token: `tok-ba-${Date.now()}-2`,
      },
    });

    // Create guest in wedding B
    const guestB = await prisma.guest.create({
      data: {
        weddingId: weddingB.id,
        name: "Guest B",
        phone: "+919876543263",
        code: "6003",
        token: `tok-ba-${Date.now()}-3`,
      },
    });

    // Attempt bulk assign in wedding A, passing guest IDs from A and B
    const count = await bulkAssignGuests({
      weddingId: weddingA.id,
      guestIds: [guestA1.id, guestA2.id, guestB.id],
      accessLevelId: accessLevelA.id,
      senderId: senderA.id,
    });

    // Only the 2 guests from wedding A should have been updated
    expect(count).toBe(2);

    const updatedA1 = await prisma.guest.findUnique({ where: { id: guestA1.id } });
    expect(updatedA1?.accessLevelId).toBe(accessLevelA.id);
    expect(updatedA1?.senderId).toBe(senderA.id);

    // Guest B from wedding B must remain completely untouched
    const untouchedB = await prisma.guest.findUnique({ where: { id: guestB.id } });
    expect(untouchedB?.accessLevelId).toBeNull();
    expect(untouchedB?.senderId).toBeNull();
  });

  it("calculates live invitation summary and delivery progress accurately", async () => {
    const wedding = await createTestWedding("summary");
    await setSendingMethod(wedding.id, "mock");

    // Guest 1: sent
    const g1 = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Progress G1",
        phone: "+919876543271",
        code: "7001",
        token: `tok-prog-${Date.now()}-1`,
        inviteStatus: "sent",
      },
    });
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: g1.id,
        kind: "template",
        templateKey: "invitation",
        status: "sent",
        sentAt: new Date(),
      },
    });

    // Guest 2: queued
    const g2 = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Progress G2",
        phone: "+919876543272",
        code: "7002",
        token: `tok-prog-${Date.now()}-2`,
        inviteStatus: "queued",
      },
    });
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: g2.id,
        kind: "template",
        templateKey: "invitation",
        status: "queued",
      },
    });

    // Check summary
    const summary = await getInvitationSummary(wedding.id);
    expect(summary.stats.totalGuests).toBe(2);
    expect(summary.stats.sent).toBe(1);
    expect(summary.stats.queued).toBe(1);

    // Check progress
    const progress = await getInvitationProgress(wedding.id);
    expect(progress.total).toBe(2);
    expect(progress.sent).toBe(1);
    expect(progress.queued).toBe(1);
    expect(progress.isFinished).toBe(false);
  });
});

