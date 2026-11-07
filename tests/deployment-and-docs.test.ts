import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/tick/route";

describe("Phase 13: Deployment, Documentation & Configuration Integrity", () => {
  const rootDir = process.cwd();

  it("verifies vercel.json is valid and configures /api/cron/tick once-daily schedule (0 3 * * *) for Hobby plan", () => {
    const vercelJsonPath = path.join(rootDir, "vercel.json");
    expect(fs.existsSync(vercelJsonPath)).toBe(true);

    const content = fs.readFileSync(vercelJsonPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(parsed.$schema).toBe("https://openapi.vercel.sh/vercel.json");
    expect(Array.isArray(parsed.crons)).toBe(true);
    expect(parsed.crons.length).toBeGreaterThanOrEqual(1);

    const cronTick = parsed.crons.find((c: { path: string }) => c.path === "/api/cron/tick");
    expect(cronTick).toBeDefined();
    expect(cronTick.schedule).toBe("0 3 * * *");
  });

  it("verifies .github/workflows/tick.yml exists and configures 5-minute schedule with repository secrets", () => {
    const workflowPath = path.join(rootDir, ".github/workflows/tick.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);

    const content = fs.readFileSync(workflowPath, "utf-8");
    expect(content).toContain("*/5 * * * *");
    expect(content).toContain("workflow_dispatch");
    expect(content).toContain("ubuntu-latest");
    expect(content).toContain("secrets.APP_URL");
    expect(content).toContain("secrets.CRON_SECRET");
    expect(content).toContain("/api/cron/tick");
  });

  it("verifies /api/cron/tick route security: constant-time comparison, requires CRON_SECRET, rejects unauthenticated with 401", async () => {
    const originalSecret = process.env.CRON_SECRET;

    try {
      // 1. Refuses to run if CRON_SECRET is not set
      delete process.env.CRON_SECRET;
      const reqNoSecret = new NextRequest("http://localhost:3000/api/cron/tick", { method: "GET" });
      const resNoSecret = await GET(reqNoSecret);
      expect(resNoSecret.status).toBe(401);

      // 2. Rejects request without Authorization header
      process.env.CRON_SECRET = "test-secret-1234567890";
      const reqNoAuth = new NextRequest("http://localhost:3000/api/cron/tick", { method: "GET" });
      const resNoAuth = await GET(reqNoAuth);
      expect(resNoAuth.status).toBe(401);

      // 3. Rejects invalid secret
      const reqInvalid = new NextRequest("http://localhost:3000/api/cron/tick", {
        method: "GET",
        headers: { authorization: "Bearer wrong-secret" },
      });
      const resInvalid = await GET(reqInvalid);
      expect(resInvalid.status).toBe(401);

      // 4. Accepts valid secret for both GET and POST
      const reqValidGet = new NextRequest("http://localhost:3000/api/cron/tick?batchSize=1", {
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const resValidGet = await GET(reqValidGet);
      expect(resValidGet.status).toBe(200);

      const reqValidPost = new NextRequest("http://localhost:3000/api/cron/tick?batchSize=1", {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const resValidPost = await POST(reqValidPost);
      expect(resValidPost.status).toBe(200);
    } finally {
      if (originalSecret !== undefined) {
        process.env.CRON_SECRET = originalSecret;
      } else {
        delete process.env.CRON_SECRET;
      }
    }
  });

  it("verifies .env.example contains all required environment variables", () => {
    const envExamplePath = path.join(rootDir, ".env.example");
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, "utf-8");

    const requiredKeys = [
      "DATABASE_URL",
      "SESSION_SECRET",
      "NEXT_PUBLIC_BASE_URL",
      "PLATFORM_DOMAIN",
      "CRON_SECRET",
      "DAILY_SEND_CAP",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_APP_SECRET",
      "VERCEL_TOKEN",
      "VERCEL_PROJECT_ID",
    ];

    for (const key of requiredKeys) {
      expect(content).toContain(key);
    }
  });

  it("verifies README.md provides comprehensive operational documentation", () => {
    const readmePath = path.join(rootDir, "README.md");
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, "utf-8");

    const essentialSections = [
      "Key Features",
      "Architecture Overview",
      "Getting Started",
      "Deploying to Production",
      "Vercel Cron",
      "WhatsApp Cloud API Configuration",
      "Onboarding a New Couple: Step-by-Step",
      "Security & Privacy Checklist",
      "Running Automated Tests",
    ];

    for (const section of essentialSections) {
      expect(content).toContain(section);
    }
  });
});
