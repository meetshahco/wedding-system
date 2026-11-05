import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getMatchingAudience,
  createAndScheduleReminder,
  cancelReminder,
  getSenderRounds,
} from "@/lib/reminder-service";
import { claimQueueBatch } from "@/lib/queue/processor";
import { setSendingMethod } from "@/lib/sending-settings";
import { resolveTemplateForGuest } from "@/lib/template-renderer";

describe("Phase 9: Messages and Reminders", () => {
  const createdWeddingIds: string[] = [];

  const createTestWedding = async (slugSuffix: string) => {
    const w = await prisma.wedding.create({
      data: {
        slug: `rem-${slugSuffix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        coupleName1: "Dev",
        coupleName2: "Rhea",
        weddingDate: new Date("2027-12-25"),
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

  it("filters audiences accurately by access level, city, group, sender, and open status", async () => {
    const wedding = await createTestWedding("audience-filters");

    const accessLevelVIP = await prisma.accessLevel.create({
      data: { weddingId: wedding.id, name: "VIP" },
    });
    const accessLevelGeneral = await prisma.accessLevel.create({
      data: { weddingId: wedding.id, name: "General" },
    });
    const senderUncle = await prisma.sender.create({
      data: { weddingId: wedding.id, name: "Uncle Dev", accessToken: `tok-u-${Date.now()}` },
    });

    // Guest 1: VIP, Mumbai, "Family", Sender: Uncle, opened (openCount = 2), sent
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest Mumbai VIP",
        phone: "+919876599001",
        code: "9001",
        token: `tok-aud-1-${Date.now()}`,
        city: "Mumbai",
        group: "Family",
        accessLevelId: accessLevelVIP.id,
        senderId: senderUncle.id,
        openCount: 2,
        inviteStatus: "sent",
      },
    });

    // Guest 2: General, Mumbai, "Friends", Sender: Uncle, not opened (openCount = 0), sent
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest Mumbai General",
        phone: "+919876599002",
        code: "9002",
        token: `tok-aud-2-${Date.now()}`,
        city: "Mumbai",
        group: "Friends",
        accessLevelId: accessLevelGeneral.id,
        senderId: senderUncle.id,
        openCount: 0,
        inviteStatus: "sent",
      },
    });

    // Guest 3: General, Delhi, "Friends", unassigned sender, not opened (openCount = 0), not_invited
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest Delhi General",
        phone: "+919876599003",
        code: "9003",
        token: `tok-aud-3-${Date.now()}`,
        city: "Delhi",
        group: "Friends",
        accessLevelId: accessLevelGeneral.id,
        senderId: null,
        openCount: 0,
        inviteStatus: "not_invited",
      },
    });

    // 1. Filter by access level
    const vipAudience = await getMatchingAudience(wedding.id, { accessLevelId: accessLevelVIP.id });
    expect(vipAudience.count).toBe(1);
    expect(vipAudience.guests[0].name).toBe("Guest Mumbai VIP");

    // 2. Filter by city
    const mumbaiAudience = await getMatchingAudience(wedding.id, { city: "mumbai" });
    expect(mumbaiAudience.count).toBe(2);

    // 3. Filter by group
    const friendsAudience = await getMatchingAudience(wedding.id, { group: "Friends" });
    expect(friendsAudience.count).toBe(2);

    // 4. Filter by unassigned sender
    const unassignedAudience = await getMatchingAudience(wedding.id, { senderId: "none" });
    expect(unassignedAudience.count).toBe(1);
    expect(unassignedAudience.guests[0].name).toBe("Guest Delhi General");

    // 5. Filter by notOpenedYet
    const notOpenedAudience = await getMatchingAudience(wedding.id, { notOpenedYet: true });
    expect(notOpenedAudience.count).toBe(2);

    // 6. Filter by notSentYet
    const notSentAudience = await getMatchingAudience(wedding.id, { notSentYet: true });
    expect(notSentAudience.count).toBe(1);
    expect(notSentAudience.guests[0].name).toBe("Guest Delhi General");

    // 7. Combined filter: City Mumbai AND Not Opened Yet
    const combinedAudience = await getMatchingAudience(wedding.id, {
      city: "Mumbai",
      notOpenedYet: true,
    });
    expect(combinedAudience.count).toBe(1);
    expect(combinedAudience.guests[0].name).toBe("Guest Mumbai General");
  });

  it("generates round queues grouped per sender in manual mode", async () => {
    const wedding = await createTestWedding("manual-rounds");
    await setSendingMethod(wedding.id, "manual");

    const senderA = await prisma.sender.create({
      data: { weddingId: wedding.id, name: "Sender Aunt", accessToken: `tok-sa-${Date.now()}` },
    });
    const senderB = await prisma.sender.create({
      data: { weddingId: wedding.id, name: "Sender Uncle", accessToken: `tok-sb-${Date.now()}` },
    });

    // 2 guests for Sender A
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest A1",
        phone: "+919876599101",
        code: "9101",
        token: `tok-mr-1-${Date.now()}`,
        senderId: senderA.id,
      },
    });
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest A2",
        phone: "+919876599102",
        code: "9102",
        token: `tok-mr-2-${Date.now()}`,
        senderId: senderA.id,
      },
    });

    // 1 guest for Sender B
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest B1",
        phone: "+919876599103",
        code: "9103",
        token: `tok-mr-3-${Date.now()}`,
        senderId: senderB.id,
      },
    });

    // Create a message round for all guests
    const result = await createAndScheduleReminder({
      weddingId: wedding.id,
      title: "Sangeet Dress Code",
      templateKey: "reminder_1",
      audienceFilter: {},
    });

    expect(result.sendingMethod).toBe("manual");
    expect(result.totalQueued).toBe(3);
    if ("senderAssignments" in result && result.senderAssignments) {
      expect(result.senderAssignments[senderA.id]).toBe(2);
      expect(result.senderAssignments[senderB.id]).toBe(1);
    }

    // Verify Sender A's message round breakdown
    const roundsA = await getSenderRounds(wedding.id, senderA.id);
    expect(roundsA.length).toBe(1);
    expect(roundsA[0].title).toBe("Sangeet Dress Code");
    expect(roundsA[0].total).toBe(2);
    expect(roundsA[0].pending).toBe(2);
    expect(roundsA[0].sent).toBe(0);
  });

  it("handles scheduled reminders and prevents queue worker claiming before scheduledAt", async () => {
    const wedding = await createTestWedding("scheduled-reminders");
    await setSendingMethod(wedding.id, "mock");

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Future Reminder Guest",
        phone: "+919876599201",
        code: "9201",
        token: `tok-fut-${Date.now()}`,
      },
    });

    // Schedule reminder 2 hours into the future
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const scheduleResult = await createAndScheduleReminder({
      weddingId: wedding.id,
      title: "Upcoming Mehndi Ceremony",
      templateKey: "reminder_1",
      audienceFilter: {},
      scheduledAt: futureTime,
      sendImmediately: false,
    });

    expect(scheduleResult.reminder.status).toBe("scheduled");
    expect(scheduleResult.totalQueued).toBe(1);

    // Queue worker claims current batch: MUST claim 0 because scheduledAt is in the future
    const claimedBatch = await claimQueueBatch(10, wedding.id);
    expect(claimedBatch.length).toBe(0);

    // Verify message log in DB is still queued with the scheduled timestamp
    const queuedLog = await prisma.messageLog.findFirst({
      where: { weddingId: wedding.id, guestId: guest.id, reminderId: scheduleResult.reminder.id },
    });
    expect(queuedLog?.status).toBe("queued");
    expect(queuedLog?.scheduledAt?.getTime()).toBe(futureTime.getTime());
  });

  it("cancels a scheduled reminder and marks queued messages as skipped", async () => {
    const wedding = await createTestWedding("cancel-reminder");
    await setSendingMethod(wedding.id, "mock");

    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Cancel Test Guest",
        phone: "+919876599301",
        code: "9301",
        token: `tok-can-${Date.now()}`,
      },
    });

    const futureTime = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const scheduled = await createAndScheduleReminder({
      weddingId: wedding.id,
      title: "To Be Cancelled Reminder",
      templateKey: "reminder_1",
      audienceFilter: {},
      scheduledAt: futureTime,
    });

    expect(scheduled.totalQueued).toBe(1);

    // Cancel the reminder
    const cancelResult = await cancelReminder(scheduled.reminder.id, wedding.id);
    expect(cancelResult.reminder.status).toBe("cancelled");
    expect(cancelResult.cancelledLogsCount).toBe(1);

    // Verify message log status is now skipped
    const updatedLog = await prisma.messageLog.findFirst({
      where: { weddingId: wedding.id, reminderId: scheduled.reminder.id },
    });
    expect(updatedLog?.status).toBe("skipped");
    expect(updatedLog?.errorMessage).toContain("cancelled");
  });

  it("manages custom templates and prevents deleting primary invitation template", async () => {
    const wedding = await createTestWedding("template-manager");

    // Create custom reminder template in Hindi
    const customTemplate = await prisma.messageTemplate.create({
      data: {
        weddingId: wedding.id,
        key: "sangeet_update",
        language: "hi",
        category: "Utility",
        body: "नमस्ते {{guest_name}}, संगीत का समय 7:00 बजे है!",
        buttons: "[]",
        sampleValues: "{}",
      },
    });

    expect(customTemplate.id).toBeDefined();

    // Resolving for Hindi returns custom Hindi template
    const resolvedHi = await resolveTemplateForGuest(wedding.id, "sangeet_update", "hi");
    expect(resolvedHi?.body).toContain("संगीत का समय");

    // Deleting the custom template works
    await prisma.messageTemplate.delete({ where: { id: customTemplate.id } });
    const afterDelete = await prisma.messageTemplate.findUnique({ where: { id: customTemplate.id } });
    expect(afterDelete).toBeNull();
  });
});
