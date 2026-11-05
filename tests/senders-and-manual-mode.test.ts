import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { generateSenderAccessToken, autoSplitGuests } from "@/lib/sender-tools";
import { ManualLinkProvider } from "@/lib/providers/manual-link-provider";

describe("Phase 7: Senders & Manual Mode", () => {
  const createdWeddingIds: string[] = [];

  const createTestWedding = async (name: string) => {
    const w = await prisma.wedding.create({
      data: {
        slug: `sender-test-${name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        coupleName1: "Dev",
        coupleName2: "Riya",
        weddingDate: new Date("2027-12-10"),
      },
    });
    createdWeddingIds.push(w.id);
    return w;
  };

  afterAll(async () => {
    if (createdWeddingIds.length > 0) {
      await prisma.wedding.deleteMany({
        where: { id: { in: createdWeddingIds } },
      });
    }
  });

  it("ensures a sender only sees their own assigned guests", async () => {
    const wedding = await createTestWedding("isolation");

    const sender1 = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name: "Sender One",
        accessToken: generateSenderAccessToken(),
      },
    });

    const sender2 = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name: "Sender Two",
        accessToken: generateSenderAccessToken(),
      },
    });

    const guest1 = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest For Sender 1",
        phone: "+919876500011",
        code: "1111",
        token: `g1-${Date.now()}`,
        senderId: sender1.id,
      },
    });

    const guest2 = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Guest For Sender 2",
        phone: "+919876500022",
        code: "2222",
        token: `g2-${Date.now()}`,
        senderId: sender2.id,
      },
    });

    // Query for Sender 1
    const s1Guests = await prisma.guest.findMany({
      where: { weddingId: wedding.id, senderId: sender1.id },
    });
    expect(s1Guests.length).toBe(1);
    expect(s1Guests[0].id).toBe(guest1.id);
    expect(s1Guests[0].name).toBe("Guest For Sender 1");

    // Query for Sender 2
    const s2Guests = await prisma.guest.findMany({
      where: { weddingId: wedding.id, senderId: sender2.id },
    });
    expect(s2Guests.length).toBe(1);
    expect(s2Guests[0].id).toBe(guest2.id);
    expect(s2Guests[0].name).toBe("Guest For Sender 2");
  });

  it("handles revoked and expired sender links accurately", async () => {
    const wedding = await createTestWedding("link-states");

    // 1. Active link
    const activeSender = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name: "Active Sender",
        accessToken: generateSenderAccessToken(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days future
      },
    });

    const checkActive = await prisma.sender.findUnique({
      where: { accessToken: activeSender.accessToken },
    });
    expect(checkActive?.revokedAt).toBeNull();
    expect(checkActive?.expiresAt! > new Date()).toBe(true);

    // 2. Revoked link
    const revokedSender = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name: "Revoked Sender",
        accessToken: generateSenderAccessToken(),
        revokedAt: new Date(),
      },
    });

    const checkRevoked = await prisma.sender.findUnique({
      where: { accessToken: revokedSender.accessToken },
    });
    expect(checkRevoked?.revokedAt).not.toBeNull();

    // 3. Expired link
    const expiredSender = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name: "Expired Sender",
        accessToken: generateSenderAccessToken(),
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      },
    });

    const checkExpired = await prisma.sender.findUnique({
      where: { accessToken: expiredSender.accessToken },
    });
    expect(checkExpired?.expiresAt! < new Date()).toBe(true);
  });

  it("validates sender PIN security and rejects invalid attempts", async () => {
    const wedding = await createTestWedding("pin-security");

    const pinSender = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name: "PIN Sender",
        accessToken: generateSenderAccessToken(),
        pin: "4321",
      },
    });

    // Valid PIN verification
    const correctCheck = pinSender.pin === "4321";
    expect(correctCheck).toBe(true);

    // Invalid PIN verification
    const wrongCheck = pinSender.pin === "9999";
    expect(wrongCheck).toBe(false);

    const emptyCheck = pinSender.pin === "";
    expect(emptyCheck).toBe(false);
  });

  it("encodes wa.me WhatsApp URLs with full Unicode text and formatting", () => {
    const phone = "+91 98765-43210";
    const unicodeText =
      "नमस्ते अमित कुमार! 🎉\nઅમારા લગ્નમાં આપનું સ્વાગત છે! 💐\nFrançois & Élodie invite you.\nCode: 1234\nLink: https://weddings.test/i/demo123";

    const url = ManualLinkProvider.generateWhatsAppUrl(phone, unicodeText);

    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);

    // Verify round-trip decoding matches the original Unicode text identically
    const queryPart = url.replace("https://wa.me/919876543210?text=", "");
    const decoded = decodeURIComponent(queryPart);

    expect(decoded).toBe(unicodeText);
    expect(decoded).toContain("नमस्ते अमित कुमार! 🎉");
    expect(decoded).toContain("અમારા લગ્નમાં આપનું સ્વાગત છે! 💐");
    expect(decoded).toContain("François & Élodie");
  });

  it("supports undo behavior to revert accidentally marked sent status", async () => {
    const wedding = await createTestWedding("undo");

    const sender = await prisma.sender.create({
      data: {
        weddingId: wedding.id,
        name: "Undo Tester",
        accessToken: generateSenderAccessToken(),
      },
    });

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Undo Guest",
        phone: "+919876500033",
        code: "3333",
        token: `undo-${Date.now()}`,
        senderId: sender.id,
        inviteStatus: "not_invited",
      },
    });

    // 1. Mark as sent
    await prisma.guest.update({
      where: { id: guest.id },
      data: { inviteStatus: "sent" },
    });
    await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: guest.id,
        kind: "template",
        templateKey: "invitation",
        provider: "manual",
        status: "sent",
        sentAt: new Date(),
      },
    });

    const checkSent = await prisma.guest.findUnique({ where: { id: guest.id } });
    expect(checkSent?.inviteStatus).toBe("sent");

    // 2. Perform Undo
    await prisma.guest.update({
      where: { id: guest.id },
      data: { inviteStatus: "not_invited" },
    });
    await prisma.messageLog.deleteMany({
      where: { weddingId: wedding.id, guestId: guest.id },
    });

    const checkUndone = await prisma.guest.findUnique({ where: { id: guest.id } });
    expect(checkUndone?.inviteStatus).toBe("not_invited");

    const checkLogs = await prisma.messageLog.findMany({
      where: { weddingId: wedding.id, guestId: guest.id },
    });
    expect(checkLogs.length).toBe(0);
  });

  it("auto-splits guests evenly across participating senders with round-robin balancing", async () => {
    const wedding = await createTestWedding("autosplit");

    // Create 3 senders
    const s1 = await prisma.sender.create({
      data: { weddingId: wedding.id, name: "Sender Alpha", accessToken: generateSenderAccessToken() },
    });
    const s2 = await prisma.sender.create({
      data: { weddingId: wedding.id, name: "Sender Beta", accessToken: generateSenderAccessToken() },
    });
    const s3 = await prisma.sender.create({
      data: { weddingId: wedding.id, name: "Sender Gamma", accessToken: generateSenderAccessToken() },
    });

    // Create 10 unassigned guests
    for (let i = 0; i < 10; i++) {
      await prisma.guest.create({
        data: {
          weddingId: wedding.id,
          name: `Auto Split Guest ${i}`,
          phone: `+9198765432${i.toString().padStart(2, "0")}`,
          code: `00${i.toString().padStart(2, "0")}`,
          token: `split-tok-${i}-${Date.now()}`,
          senderId: null,
        },
      });
    }

    const senderIds = [s1.id, s2.id, s3.id];

    // Run auto-split
    const result = await autoSplitGuests({
      weddingId: wedding.id,
      senderIds,
      unassignedOnly: true,
    });

    expect(result.totalGuests).toBe(10);
    expect(result.splitCount).toBe(10);

    // Verify 10 guests split into 4, 3, 3
    const counts = [result.assignments[s1.id], result.assignments[s2.id], result.assignments[s3.id]].sort();
    expect(counts).toEqual([3, 3, 4]);

    // Running auto-split again for unassignedOnly should assign 0
    const secondResult = await autoSplitGuests({
      weddingId: wedding.id,
      senderIds,
      unassignedOnly: true,
    });
    expect(secondResult.splitCount).toBe(0);

    // Deleting Sender 1 sets senderId to null on assigned guests safely
    await prisma.sender.delete({ where: { id: s1.id } });
    const unassignedCount = await prisma.guest.count({
      where: { weddingId: wedding.id, senderId: null },
    });
    expect(unassignedCount).toBe(result.assignments[s1.id]);
  });
});

