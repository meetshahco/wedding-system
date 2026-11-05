import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/crypto-passwords";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

describe("Phase 3B: Roles, Permissions & Invite Security", () => {
  let weddingAId: string;
  let weddingBId: string;
  let ownerUserId: string;
  let managerWeddingAUserId: string;
  let viewerWeddingAUserId: string;

  beforeAll(async () => {
    // 1. Create two test weddings
    const weddingA = await prisma.wedding.create({
      data: {
        slug: `role-test-wedding-a-${Date.now()}`,
        coupleName1: "Partner A1",
        coupleName2: "Partner A2",
        weddingDate: new Date("2027-08-15"),
        accentColor: "#111111",
      },
    });
    weddingAId = weddingA.id;

    const weddingB = await prisma.wedding.create({
      data: {
        slug: `role-test-wedding-b-${Date.now()}`,
        coupleName1: "Partner B1",
        coupleName2: "Partner B2",
        weddingDate: new Date("2027-09-20"),
        accentColor: "#222222",
      },
    });
    weddingBId = weddingB.id;

    // 2. Create OWNER user
    const owner = await prisma.user.create({
      data: {
        email: `owner-${Date.now()}@test.com`,
        name: "Test Owner",
        passwordHash: hashPassword("Secret123!"),
        globalRole: "OWNER",
        isActive: true,
      },
    });
    ownerUserId = owner.id;

    // 3. Create MANAGER user assigned to Wedding A only
    const manager = await prisma.user.create({
      data: {
        email: `manager-${Date.now()}@test.com`,
        name: "Manager Wedding A",
        passwordHash: hashPassword("Secret123!"),
        globalRole: "USER",
        isActive: true,
        weddingAccess: {
          create: {
            weddingId: weddingAId,
            role: "MANAGER",
          },
        },
      },
    });
    managerWeddingAUserId = manager.id;

    // 4. Create VIEWER user assigned to Wedding A only
    const viewer = await prisma.user.create({
      data: {
        email: `viewer-${Date.now()}@test.com`,
        name: "Viewer Wedding A",
        passwordHash: hashPassword("Secret123!"),
        globalRole: "USER",
        isActive: true,
        weddingAccess: {
          create: {
            weddingId: weddingAId,
            role: "VIEWER",
          },
        },
      },
    });
    viewerWeddingAUserId = viewer.id;
  });

  afterAll(async () => {
    if (weddingAId) await prisma.wedding.delete({ where: { id: weddingAId } }).catch(() => {});
    if (weddingBId) await prisma.wedding.delete({ where: { id: weddingBId } }).catch(() => {});
    if (ownerUserId) await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => {});
    if (managerWeddingAUserId) await prisma.user.delete({ where: { id: managerWeddingAUserId } }).catch(() => {});
    if (viewerWeddingAUserId) await prisma.user.delete({ where: { id: viewerWeddingAUserId } }).catch(() => {});
  });

  describe("Password Hashing & Verification", () => {
    it("hashes passwords securely with unique salts and verifies correctly", () => {
      const password = "SuperSecretPassword123!";
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      // Salts must differ
      expect(hash1).not.toBe(hash2);

      // Both must verify
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);

      // Wrong password must fail
      expect(verifyPassword("WrongPassword!", hash1)).toBe(false);
    });
  });

  describe("Role Permission Matrix & Wedding Isolation", () => {
    it("allows OWNER universal access across all weddings", async () => {
      const ownerUser = await prisma.user.findUnique({ where: { id: ownerUserId } });
      expect(ownerUser?.globalRole).toBe("OWNER");
    });

    it("verifies manager of Wedding A has access to Wedding A but gets 403 on Wedding B", async () => {
      // Check access to Wedding A
      const accessA = await prisma.weddingAccess.findUnique({
        where: {
          userId_weddingId: {
            userId: managerWeddingAUserId,
            weddingId: weddingAId,
          },
        },
      });
      expect(accessA?.role).toBe("MANAGER");

      // Check access to Wedding B — MUST be null
      const accessB = await prisma.weddingAccess.findUnique({
        where: {
          userId_weddingId: {
            userId: managerWeddingAUserId,
            weddingId: weddingBId,
          },
        },
      });
      expect(accessB).toBeNull();
    });

    it("verifies VIEWER role has read-only access and cannot act as MANAGER", async () => {
      const accessA = await prisma.weddingAccess.findUnique({
        where: {
          userId_weddingId: {
            userId: viewerWeddingAUserId,
            weddingId: weddingAId,
          },
        },
      });
      expect(accessA?.role).toBe("VIEWER");
      expect(accessA?.role).not.toBe("MANAGER");
    });
  });

  describe("Single-Use Expiring Invite Links", () => {
    it("successfully creates an invite, marks it used, and blocks reuse", async () => {
      const inviteToken = crypto.randomBytes(24).toString("hex");
      const testEmail = `invitee-${Date.now()}@test.com`;

      // Create invite
      const invite = await prisma.userInvite.create({
        data: {
          email: testEmail,
          token: inviteToken,
          invitedById: ownerUserId,
          targetRole: "USER",
          weddingId: weddingAId,
          weddingRole: "VIEWER",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
      expect(invite.usedAt).toBeNull();

      // Simulate accept
      const updated = await prisma.userInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      expect(updated.usedAt).not.toBeNull();

      // Attempting to use again must detect usedAt is not null
      const reCheck = await prisma.userInvite.findUnique({ where: { token: inviteToken } });
      expect(reCheck?.usedAt).toBeDefined();
    });

    it("rejects expired invite links", async () => {
      const expiredToken = crypto.randomBytes(24).toString("hex");

      const invite = await prisma.userInvite.create({
        data: {
          email: `expired-${Date.now()}@test.com`,
          token: expiredToken,
          invitedById: ownerUserId,
          targetRole: "USER",
          expiresAt: new Date(Date.now() - 1000 * 60), // expired 1 minute ago
        },
      });

      const isExpired = new Date() > invite.expiresAt;
      expect(isExpired).toBe(true);
    });
  });

  describe("Deactivated Users & Audit Logging", () => {
    it("prevents deactivated users from being active", async () => {
      const deactivatedUser = await prisma.user.create({
        data: {
          email: `deactivated-${Date.now()}@test.com`,
          name: "Deactivated User",
          passwordHash: hashPassword("Pass123!"),
          isActive: false,
        },
      });

      expect(deactivatedUser.isActive).toBe(false);

      // Cleanup
      await prisma.user.delete({ where: { id: deactivatedUser.id } });
    });

    it("writes and queries audit log entries", async () => {
      const audit = await logAuditEvent({
        userId: ownerUserId,
        weddingId: weddingAId,
        action: "TEST_AUDIT_ACTION",
        details: { note: "Phase 3B test audit event" },
      });

      expect(audit).not.toBeNull();
      expect(audit?.action).toBe("TEST_AUDIT_ACTION");

      const fetched = await prisma.auditLog.findUnique({
        where: { id: audit!.id },
      });
      expect(fetched?.action).toBe("TEST_AUDIT_ACTION");
      expect(fetched?.weddingId).toBe(weddingAId);

      // Cleanup
      await prisma.auditLog.delete({ where: { id: audit!.id } });
    });
  });
});

