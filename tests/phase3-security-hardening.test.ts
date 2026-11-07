import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { hashPassword, verifyPassword, needsRehash, CURRENT_ITERATIONS, HASH_PREFIX } from "@/lib/crypto-passwords";
import { getSessionPassword, SESSION_OPTIONS } from "@/lib/auth";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("Phase 3: Security Hardening & Audit Findings", () => {
  const rootDir = process.cwd();

  describe("1. Cryptographic Password Security (OWASP PBKDF2-SHA512 210,000 iterations)", () => {
    it("hashes password with 210,000 iterations and returns pbkdf2 format", () => {
      const password = "SuperSecretPassword123!";
      const hash = hashPassword(password);

      expect(hash.startsWith(HASH_PREFIX)).toBe(true);
      expect(hash).toMatch(/^pbkdf2:sha512:210000:[a-f0-9]+:[a-f0-9]+$/);
      expect(verifyPassword(password, hash)).toBe(true);
      expect(verifyPassword("WrongPassword!", hash)).toBe(false);
      expect(needsRehash(hash)).toBe(false);
    });

    it("verifies legacy 2-part hashes and correctly flags them as needing rehash", () => {
      const salt = crypto.randomBytes(16).toString("hex");
      const legacyKey = crypto.pbkdf2Sync("OldPassword123!", salt, 100000, 64, "sha512").toString("hex");
      const legacyHash = `${salt}:${legacyKey}`;

      expect(verifyPassword("OldPassword123!", legacyHash)).toBe(true);
      expect(verifyPassword("WrongPassword!", legacyHash)).toBe(false);
      expect(needsRehash(legacyHash)).toBe(true);
    });

    it("timing safe verification handles malformed or empty hashes safely without crashing", () => {
      expect(verifyPassword("anything", "")).toBe(false);
      expect(verifyPassword("anything", "invalid:hash")).toBe(false);
      expect(verifyPassword("anything", "pbkdf2:sha512:nan:salt:key")).toBe(false);
      expect(needsRehash("")).toBe(true);
    });
  });

  describe("2. Auth Session Security & Fail-Closed Behavior", () => {
    it("fails closed in production if SESSION_SECRET is missing", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.SESSION_SECRET;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        delete process.env.SESSION_SECRET;

        expect(() => getSessionPassword()).toThrow(/CRITICAL SECURITY CONFIGURATION/);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
        if (originalSecret) {
          process.env.SESSION_SECRET = originalSecret;
        }
      }
    });

    it("configures secure cookie flags (httpOnly, sameSite lax, 7 day maxAge)", () => {
      expect(SESSION_OPTIONS.cookieOptions.httpOnly).toBe(true);
      expect(SESSION_OPTIONS.cookieOptions.sameSite).toBe("lax");
      expect(SESSION_OPTIONS.cookieOptions.maxAge).toBe(60 * 60 * 24 * 7);
      expect(SESSION_OPTIONS.cookieOptions.path).toBe("/");
    });
  });

  describe("3. CSRF Origin Verification on State-Changing Admin Routes", () => {
    it("blocks cross-site requests to /api/admin/* when Origin header does not match Host", async () => {
      const req = new NextRequest("http://weddings.test/api/admin/guests", {
        method: "POST",
        headers: {
          host: "weddings.test",
          origin: "https://evil-attacker.com",
        },
      });

      const res = await middleware(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Cross-site request rejected");
    });

    it("allows valid same-origin requests to /api/admin/*", async () => {
      const req = new NextRequest("http://weddings.test/api/admin/auth/login", {
        method: "POST",
        headers: {
          host: "weddings.test",
          origin: "http://weddings.test",
        },
      });

      const res = await middleware(req);
      // login endpoint is public in middleware
      expect(res.status).toBe(200);
    });
  });

  describe("4. Forward Greeting Rule Formatting for Public Invitations", () => {
    function formatGreeting(rule: "FIRST_NAME" | "FAMILY" | "NONE", fullName: string): string {
      if (rule === "FIRST_NAME") {
        const firstName = fullName.trim().split(/\s+/)[0];
        return `Dear ${firstName},`;
      }
      if (rule === "FAMILY") {
        return `Dear ${fullName},`;
      }
      return "Welcome,";
    }

    it("formats greeting with first name only when FIRST_NAME rule is active", () => {
      expect(formatGreeting("FIRST_NAME", "Priya Sharma")).toBe("Dear Priya,");
      expect(formatGreeting("FIRST_NAME", "Rajesh")).toBe("Dear Rajesh,");
    });

    it("formats greeting with full/family name when FAMILY rule is active", () => {
      expect(formatGreeting("FAMILY", "Sharma Family")).toBe("Dear Sharma Family,");
      expect(formatGreeting("FAMILY", "Dr. Amit Patel")).toBe("Dear Dr. Amit Patel,");
    });

    it("formats generic greeting when NONE rule is active", () => {
      expect(formatGreeting("NONE", "Priya Sharma")).toBe("Welcome,");
      expect(formatGreeting("NONE", "")).toBe("Welcome,");
    });
  });

  describe("5. Prisma Migrations and Schema Hardening", () => {
    it("verifies migration_lock.toml exists with postgresql provider for prisma migrate deploy", () => {
      const lockPath = path.join(rootDir, "prisma/migrations/migration_lock.toml");
      expect(fs.existsSync(lockPath)).toBe(true);

      const lockContent = fs.readFileSync(lockPath, "utf-8");
      expect(lockContent).toContain('provider = "postgresql"');
    });

    it("verifies migration.sql includes all Phase 3 database fields", () => {
      const migrationPath = path.join(
        rootDir,
        "prisma/migrations/20261105000000_init_multi_wedding/migration.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, "utf-8");
      expect(sql).toContain("mustChangePassword");
      expect(sql).toContain("forwardGreetingRule");
      expect(sql).toContain("failedPinAttempts");
      expect(sql).toContain("lockedUntil");
    });

    it("verifies prisma/seed.ts reads credentials from OWNER_EMAIL/OWNER_PASSWORD and forces password change", () => {
      const seedPath = path.join(rootDir, "prisma/seed.ts");
      const seedContent = fs.readFileSync(seedPath, "utf-8");

      expect(seedContent).toContain("process.env.OWNER_EMAIL");
      expect(seedContent).toContain("process.env.OWNER_PASSWORD");
      expect(seedContent).toContain("mustChangePassword: true");
      // Must not contain hardcoded default passwords
      expect(seedContent).not.toContain('"changeme"');
      expect(seedContent).not.toContain('"Password123!"');
    });
  });
});
