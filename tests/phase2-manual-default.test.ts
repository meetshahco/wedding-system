import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { isWhatsAppApiEnabled } from "@/lib/features";
import { getSendingMethod, setSendingMethod } from "@/lib/sending-settings";
import { getHealthCheck } from "@/lib/dashboard-service";

describe("Phase 2: Manual Mode Default & WhatsApp API Coming Soon", () => {
  let weddingId: string;
  const originalEnv = process.env.ENABLE_WHATSAPP_API;

  beforeAll(async () => {
    const wedding = await prisma.wedding.create({
      data: {
        slug: `phase2-test-${Date.now()}`,
        coupleName1: "Rohan",
        coupleName2: "Pooja",
        weddingDate: new Date("2027-04-15T10:00:00Z"),
        accentColor: "#111111",
      },
    });
    weddingId = wedding.id;
  });

  afterAll(async () => {
    process.env.ENABLE_WHATSAPP_API = originalEnv;
    await prisma.wedding.delete({ where: { id: weddingId } }).catch(() => {});
  });

  describe("Configuration Flag: ENABLE_WHATSAPP_API=false (v1 Default)", () => {
    beforeAll(() => {
      delete process.env.ENABLE_WHATSAPP_API;
    });

    it("evaluates isWhatsAppApiEnabled() to false by default", () => {
      expect(isWhatsAppApiEnabled()).toBe(false);
    });

    it("locks getSendingMethod to manual by default", async () => {
      const method = await getSendingMethod(weddingId);
      expect(method).toBe("manual");
    });

    it("blocks setting whatsapp_cloud sendingMethod on the server side", async () => {
      await expect(setSendingMethod(weddingId, "whatsapp_cloud")).rejects.toThrow(
        "WhatsApp API sending is coming soon"
      );
    });

    it("allows manual sendingMethod to be explicitly set and retrieved", async () => {
      await setSendingMethod(weddingId, "manual");
      const method = await getSendingMethod(weddingId);
      expect(method).toBe("manual");
    });

    it("shows health check diagnostic as 'Not enabled (coming soon)' without error", async () => {
      const health = await getHealthCheck(weddingId);
      expect(health.whatsappApi).toBeDefined();
      expect(health.whatsappApi.status).toBe("not_enabled");
      expect(health.whatsappApi.label).toBe("Not enabled (coming soon)");
      expect(health.status).not.toBe("UNHEALTHY");
    });
  });

  describe("Configuration Flag: ENABLE_WHATSAPP_API=true (Development / Unlocked)", () => {
    beforeAll(() => {
      process.env.ENABLE_WHATSAPP_API = "true";
    });

    it("evaluates isWhatsAppApiEnabled() to true", () => {
      expect(isWhatsAppApiEnabled()).toBe(true);
    });

    it("allows setting whatsapp_cloud sendingMethod when flag is true", async () => {
      await setSendingMethod(weddingId, "whatsapp_cloud");
      const method = await getSendingMethod(weddingId);
      expect(method).toBe("whatsapp_cloud");
    });

    it("shows health check diagnostic as Active & Configured when flag is true", async () => {
      const health = await getHealthCheck(weddingId);
      expect(health.whatsappApi.status).toBe("ok");
      expect(health.whatsappApi.label).toBe("Active & Configured");
    });
  });
});

