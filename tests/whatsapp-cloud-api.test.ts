import { describe, it, expect, afterAll } from "vitest";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CloudApiProvider } from "@/lib/providers/cloud-api-provider";

describe("Phase 11: WhatsApp Cloud API Provider & Webhooks", () => {
  const createdWeddingIds: string[] = [];
  const testSecret = "test-webhook-app-secret-12345";
  const testVerifyToken = "test-verify-token-xyz";

  const createTestWedding = async (slugSuffix: string) => {
    const w = await prisma.wedding.create({
      data: {
        slug: `cloud-${slugSuffix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        coupleName1: "Sameer",
        coupleName2: "Pooja",
        weddingDate: new Date("2028-03-20"),
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

  it("verifies webhook signature using HMAC SHA-256 and validates handshake challenge", () => {
    const provider = new CloudApiProvider({
      appSecret: testSecret,
      verifyToken: testVerifyToken,
    });

    const rawPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

    // Generate valid HMAC SHA-256 signature
    const validHash = crypto.createHmac("sha256", testSecret).update(rawPayload).digest("hex");
    const validSignatureHeader = `sha256=${validHash}`;

    // 1. Valid signature passes
    expect(provider.verifySignature(rawPayload, validSignatureHeader)).toBe(true);

    // 2. Tampered payload fails
    const tamperedPayload = JSON.stringify({ object: "whatsapp_business_account", entry: ["tampered"] });
    expect(provider.verifySignature(tamperedPayload, validSignatureHeader)).toBe(false);

    // 3. Wrong secret signature fails
    const wrongSecretHash = crypto.createHmac("sha256", "wrong-secret").update(rawPayload).digest("hex");
    expect(provider.verifySignature(rawPayload, `sha256=${wrongSecretHash}`)).toBe(false);

    // 4. Missing or malformed signature fails
    expect(provider.verifySignature(rawPayload, null)).toBe(false);
    expect(provider.verifySignature(rawPayload, "invalid-format")).toBe(false);

    // 5. Handshake validation
    const challenge = "meta_random_challenge_string_98765";
    expect(provider.verifyHandshake("subscribe", testVerifyToken, challenge)).toBe(challenge);
    expect(provider.verifyHandshake("subscribe", "wrong-token", challenge)).toBeNull();
    expect(provider.verifyHandshake("invalid-mode", testVerifyToken, challenge)).toBeNull();
  });

  it("maps delivery status updates (delivered, read, failed) to the right wedding and guest", async () => {
    const weddingA = await createTestWedding("wa-status-a");
    const weddingB = await createTestWedding("wa-status-b");

    const provider = new CloudApiProvider({ appSecret: testSecret });

    const guestA = await prisma.guest.create({
      data: {
        weddingId: weddingA.id,
        name: "Guest Wedding A",
        phone: "+919876511111",
        code: "1111",
        token: `tok-wa-a-${Date.now()}`,
        inviteStatus: "sent",
      },
    });

    const guestB = await prisma.guest.create({
      data: {
        weddingId: weddingB.id,
        name: "Guest Wedding B",
        phone: "+919876522222",
        code: "2222",
        token: `tok-wa-b-${Date.now()}`,
        inviteStatus: "sent",
      },
    });

    const wamidA = `wamid.TEST_MSG_A_${Date.now()}`;
    const wamidB = `wamid.TEST_MSG_B_${Date.now()}`;

    // Create MessageLogs
    await prisma.messageLog.create({
      data: {
        weddingId: weddingA.id,
        guestId: guestA.id,
        kind: "template",
        templateKey: "invitation",
        externalMessageId: wamidA,
        status: "sent",
        sentAt: new Date(),
      },
    });

    await prisma.messageLog.create({
      data: {
        weddingId: weddingB.id,
        guestId: guestB.id,
        kind: "template",
        templateKey: "invitation",
        externalMessageId: wamidB,
        status: "sent",
        sentAt: new Date(),
      },
    });

    // 1. Simulate webhook status update: wamidA delivered
    const webhookPayloadDelivered = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_id_123",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: wamidA,
                    status: "delivered",
                    timestamp: "1710005000",
                    recipient_id: "919876511111",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const resDelivered = await provider.processWebhookEvent(webhookPayloadDelivered);
    expect(resDelivered.processedStatuses).toBe(1);

    // Verify Guest A and MessageLog A updated to delivered
    const updatedGuestA = await prisma.guest.findUnique({ where: { id: guestA.id } });
    expect(updatedGuestA?.inviteStatus).toBe("delivered");

    const updatedLogA = await prisma.messageLog.findFirst({ where: { externalMessageId: wamidA } });
    expect(updatedLogA?.status).toBe("delivered");
    expect(updatedLogA?.deliveredAt).toBeDefined();

    // Verify Guest B in Wedding B remained untouched
    const untouchedGuestB = await prisma.guest.findUnique({ where: { id: guestB.id } });
    expect(untouchedGuestB?.inviteStatus).toBe("sent");

    // 2. Simulate webhook status update: wamidA read
    const webhookPayloadRead = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_id_123",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: wamidA,
                    status: "read",
                    timestamp: "1710006000",
                    recipient_id: "919876511111",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    await provider.processWebhookEvent(webhookPayloadRead);
    const readGuestA = await prisma.guest.findUnique({ where: { id: guestA.id } });
    expect(readGuestA?.inviteStatus).toBe("read");

    const readLogA = await prisma.messageLog.findFirst({ where: { externalMessageId: wamidA } });
    expect(readLogA?.status).toBe("read");
    expect(readLogA?.readAt).toBeDefined();
  });

  it("handles STOP opt-out and START opt-in behaviour, recording lastInboundAt and inbound logs", async () => {
    const wedding = await createTestWedding("wa-stop");
    const provider = new CloudApiProvider({ appSecret: testSecret });

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Opt-Out Guest",
        phone: "+919876533333",
        code: "3333",
        token: `tok-wa-stop-${Date.now()}`,
        optedOut: false,
        lastInboundAt: null,
      },
    });

    // 1. Inbound STOP message
    const stopPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_id_123",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: "919876533333",
                    id: `wamid.INBOUND_STOP_${Date.now()}`,
                    timestamp: "1710010000",
                    type: "text",
                    text: { body: "STOP" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const stopResult = await provider.processWebhookEvent(stopPayload);
    expect(stopResult.optOuts).toBe(1);
    expect(stopResult.processedInbounds).toBe(1);

    // Verify guest is opted out and lastInboundAt is set
    const optedOutGuest = await prisma.guest.findUnique({ where: { id: guest.id } });
    expect(optedOutGuest?.optedOut).toBe(true);
    expect(optedOutGuest?.lastInboundAt).toBeDefined();

    // Verify inbound message log was written
    const inboundLog = await prisma.messageLog.findFirst({
      where: { weddingId: wedding.id, guestId: guest.id, kind: "inbound" },
    });
    expect(inboundLog).toBeDefined();
    expect(inboundLog?.status).toBe("read");

    // 2. Inbound START message resumes opt-in
    const startPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_id_123",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: "919876533333",
                    id: `wamid.INBOUND_START_${Date.now()}`,
                    timestamp: "1710020000",
                    type: "text",
                    text: { body: "START" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    await provider.processWebhookEvent(startPayload);
    const resumedGuest = await prisma.guest.findUnique({ where: { id: guest.id } });
    expect(resumedGuest?.optedOut).toBe(false);
  });

  it("handles Cloud API send() HTTP responses and categorizes permanent versus retryable errors", async () => {
    // 1. Success mock
    const mockSuccessFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.SUCCESS_123" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const successProvider = new CloudApiProvider({
      phoneNumberId: "phone_123",
      accessToken: "token_123",
      fetchFn: mockSuccessFetch,
    });

    const successRes = await successProvider.send({
      weddingId: "w1",
      guestId: "g1",
      phone: "+919876543210",
      body: "Test hello",
    });

    expect(successRes.success).toBe(true);
    expect(successRes.status).toBe("sent");
    expect(successRes.externalMessageId).toBe("wamid.SUCCESS_123");

    // 2. Permanent error mock (Meta error 131030: recipient not allowed in developer test mode)
    const mockPermanentFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Recipient phone number not in allowed list",
            type: "OAuthException",
            code: 131030,
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );

    const permProvider = new CloudApiProvider({
      phoneNumberId: "phone_123",
      accessToken: "token_123",
      fetchFn: mockPermanentFetch,
    });

    const permRes = await permProvider.send({
      weddingId: "w1",
      guestId: "g1",
      phone: "+919876543210",
      body: "Test hello",
    });

    expect(permRes.success).toBe(false);
    expect(permRes.retryable).toBe(false);
    expect(permRes.errorMessage).toContain("131030");

    // 3. Retryable error mock (Meta error 130429: rate limit exceeded)
    const mockRateLimitFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: {
            message: "Rate limit hit",
            code: 130429,
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );

    const retryProvider = new CloudApiProvider({
      phoneNumberId: "phone_123",
      accessToken: "token_123",
      fetchFn: mockRateLimitFetch,
    });

    const retryRes = await retryProvider.send({
      weddingId: "w1",
      guestId: "g1",
      phone: "+919876543210",
      body: "Test hello",
    });

    expect(retryRes.success).toBe(false);
    expect(retryRes.retryable).toBe(true);
  });
});
