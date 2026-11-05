import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { renderTemplate, resolveTemplateForGuest } from "@/lib/template-renderer";
import { mockProvider } from "@/lib/providers/mock-provider";
import { claimQueueBatch, processQueueBatch } from "@/lib/queue/processor";
import { setSendingMethod } from "@/lib/sending-settings";

describe("Phase 6: Provider Architecture & Sending Engine", () => {
  const createdWeddingIds: string[] = [];

  const createTestWedding = async (name: string) => {
    const w = await prisma.wedding.create({
      data: {
        slug: `eng-${name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        coupleName1: "Kabir",
        coupleName2: "Tara",
        weddingDate: new Date("2027-11-20"),
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

  it("renders templates with Unicode names, multi-language characters, and emojis", async () => {
    const wedding = await createTestWedding("unicode");

    const templateBody =
      "नमस्ते {{guest_name}}! 🎉 वर-वधु: {{couple_names}}। दिनांक: {{wedding_date}}। કોડ: {{code}}। લિંક: {{invite_url}}।";

    const rendered = renderTemplate(templateBody, {
      guest_name: "अमित कुमार & પ્રિયા શાહ 💐",
      couple_names: "कबीर और तारा 💍",
      wedding_date: "20 नवंबर, 2027",
      code: "9876",
      invite_url: "https://weddings.test/i/unicode123",
    });

    expect(rendered).toContain("अमित कुमार & પ્રિયા શાહ 💐");
    expect(rendered).toContain("कबीर और तारा 💍");
    expect(rendered).toContain("20 नवंबर, 2027");
    expect(rendered).toContain("કોડ: 9876");
    expect(rendered).toContain("https://weddings.test/i/unicode123");

    // Test resolving templates by language with fallback
    await prisma.messageTemplate.create({
      data: {
        weddingId: wedding.id,
        key: "save_the_date",
        language: "en",
        category: "Marketing",
        body: "Save the date for {{couple_names}}!",
        buttons: "[]",
        sampleValues: "{}",
      },
    });

    await prisma.messageTemplate.create({
      data: {
        weddingId: wedding.id,
        key: "save_the_date",
        language: "hi",
        category: "Marketing",
        body: "कृपया {{couple_names}} के विवाह की तारीख सुरक्षित रखें!",
        buttons: "[]",
        sampleValues: "{}",
      },
    });

    // Requesting Hindi returns Hindi template
    const hiTemplate = await resolveTemplateForGuest(wedding.id, "save_the_date", "hi");
    expect(hiTemplate?.language).toBe("hi");
    expect(hiTemplate?.body).toContain("तारीख सुरक्षित रखें");

    // Requesting unsupported language (e.g. Spanish 'es') falls back to English ('en')
    const fallbackTemplate = await resolveTemplateForGuest(wedding.id, "save_the_date", "es");
    expect(fallbackTemplate?.language).toBe("en");
    expect(fallbackTemplate?.body).toContain("Save the date");
  });

  it("enforces safe queue claiming with zero overlap between concurrent workers", async () => {
    const wedding = await createTestWedding("claiming");

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Claim Test Guest",
        phone: "+919876500002",
        code: "1111",
        token: `claim-tok-${Date.now()}`,
      },
    });

    // Create 10 queued message logs sequentially so their timestamps are cleanly defined
    for (let i = 0; i < 10; i++) {
      await prisma.messageLog.create({
        data: {
          weddingId: wedding.id,
          guestId: guest.id,
          kind: "template",
          templateKey: `test_claim_${i}`,
          status: "queued",
        },
      });
    }

    // Concurrently claim batches of 5
    const [batch1, batch2] = await Promise.all([
      claimQueueBatch(5, wedding.id),
      claimQueueBatch(5, wedding.id),
    ]);

    expect(batch1.length).toBe(5);
    expect(batch2.length).toBe(5);

    // Verify ZERO overlap between the two concurrent claims
    const intersection = batch1.filter((id) => batch2.includes(id));
    expect(intersection).toEqual([]);

    // Total claimed must be 10 distinct IDs
    const allClaimed = new Set([...batch1, ...batch2]);
    expect(allClaimed.size).toBe(10);
  });

  it("enforces rolling 24-hour daily send caps and blocks excess automated sends", async () => {
    const wedding = await createTestWedding("caps");

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Cap Test Guest",
        phone: "+919876500003",
        code: "2222",
        token: `cap-tok-${Date.now()}`,
      },
    });

    // Configure daily cap of 2 for this wedding
    await prisma.setting.create({
      data: { weddingId: wedding.id, key: "daily_send_cap", value: "2" },
    });
    await setSendingMethod(wedding.id, "mock");

    // Create 3 queued jobs
    for (let i = 0; i < 3; i++) {
      await prisma.messageLog.create({
        data: {
          weddingId: wedding.id,
          guestId: guest.id,
          kind: "template",
          templateKey: `cap_job_${i}`,
          status: "queued",
        },
      });
    }

    // Process batch of 3
    const summary = await processQueueBatch({ batchSize: 3, weddingId: wedding.id });

    // 2 should succeed, 1 should be blocked by cap
    expect(summary.succeeded).toBe(2);
    expect(summary.capBlocked).toBe(1);

    // Verify 3rd job is back in queued with backoff nextAttemptAt
    const remainingQueued = await prisma.messageLog.findFirst({
      where: { weddingId: wedding.id, status: "queued" },
    });
    expect(remainingQueued).not.toBeNull();
    expect(remainingQueued?.nextAttemptAt).not.toBeNull();
  });

  it("handles retryable errors with exponential backoff", async () => {
    const wedding = await createTestWedding("retryable");
    await setSendingMethod(wedding.id, "mock");

    const retryGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Temporary Glitch Guest",
        phone: "+919876549999",
        code: "9999",
        token: `glitch-tok-${Date.now()}`,
      },
    });

    const retryJob = await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: retryGuest.id,
        kind: "template",
        templateKey: `retry_job`,
        status: "queued",
      },
    });

    // Attempt 1: Should fail but schedule next attempt with backoff
    await processQueueBatch({ batchSize: 1, weddingId: wedding.id });
    const retryAfter1 = await prisma.messageLog.findUnique({ where: { id: retryJob.id } });
    expect(retryAfter1?.status).toBe("queued");
    expect(retryAfter1?.attempts).toBe(1);
    expect(retryAfter1?.nextAttemptAt).not.toBeNull();
  });

  it("handles permanent failures immediately without retrying", async () => {
    const wedding = await createTestWedding("permanent");
    await setSendingMethod(wedding.id, "mock");

    const permanentGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Permanent Fail Guest",
        phone: "+919876540000",
        code: "0000",
        token: `perm-tok-${Date.now()}`,
      },
    });

    const permJob = await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: permanentGuest.id,
        kind: "template",
        templateKey: `perm_job`,
        status: "queued",
      },
    });

    // Attempt 1: Should fail immediately without retrying (retryable: false)
    await processQueueBatch({ batchSize: 1, weddingId: wedding.id });
    const permAfter1 = await prisma.messageLog.findUnique({ where: { id: permJob.id } });
    expect(permAfter1?.status).toBe("failed");
    expect(permAfter1?.errorMessage).toContain("permanent failure");

    const checkGuest = await prisma.guest.findUnique({ where: { id: permanentGuest.id } });
    expect(checkGuest?.inviteStatus).toBe("failed");
  });

  it("simulates Mock provider delivery status transitions (sent -> delivered -> read)", async () => {
    const wedding = await createTestWedding("status");
    await setSendingMethod(wedding.id, "mock");

    const statusGuest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Status Test Guest",
        phone: "+919876543211",
        code: "4444",
        token: `status-tok-${Date.now()}`,
      },
    });

    const job = await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: statusGuest.id,
        kind: "template",
        templateKey: `status_job`,
        status: "queued",
      },
    });

    // 1. Process send
    await processQueueBatch({ batchSize: 1, weddingId: wedding.id });
    const sentLog = await prisma.messageLog.findUnique({ where: { id: job.id } });
    expect(sentLog?.status).toBe("sent");
    expect(sentLog?.externalMessageId).toBeTruthy();

    const externalId = sentLog!.externalMessageId!;

    // 2. Simulate delivered
    const delRes = await mockProvider.simulateStatusTransition(externalId, "delivered");
    expect(delRes).toBe(true);

    const delLog = await prisma.messageLog.findUnique({ where: { id: job.id } });
    expect(delLog?.status).toBe("delivered");
    expect(delLog?.deliveredAt).not.toBeNull();

    // 3. Simulate read
    const readRes = await mockProvider.simulateStatusTransition(externalId, "read");
    expect(readRes).toBe(true);

    const readLog = await prisma.messageLog.findUnique({ where: { id: job.id } });
    expect(readLog?.status).toBe("read");
    expect(readLog?.readAt).not.toBeNull();

    // Verify Guest status also updated
    const finalGuest = await prisma.guest.findUnique({ where: { id: statusGuest.id } });
    expect(finalGuest?.inviteStatus).toBe("read");
  });

  it("ignores queued jobs when the wedding sendingMethod is manual", async () => {
    const wedding = await createTestWedding("manual");
    await setSendingMethod(wedding.id, "manual");

    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        name: "Manual Guest",
        phone: "+919876500004",
        code: "3333",
        token: `manual-tok-${Date.now()}`,
      },
    });

    const manualJob = await prisma.messageLog.create({
      data: {
        weddingId: wedding.id,
        guestId: guest.id,
        kind: "template",
        templateKey: `manual_job`,
        status: "queued",
      },
    });

    const summary = await processQueueBatch({ batchSize: 1, weddingId: wedding.id });
    expect(summary.skipped).toBe(1);

    // Job remains in queued state for manual senders to handle via wa.me links
    const checkJob = await prisma.messageLog.findUnique({ where: { id: manualJob.id } });
    expect(checkJob?.status).toBe("queued");
  });
});
