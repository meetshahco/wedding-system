import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 13: Deployment, Documentation & Configuration Integrity", () => {
  const rootDir = process.cwd();

  it("verifies vercel.json is valid and configures /api/cron/tick schedule", () => {
    const vercelJsonPath = path.join(rootDir, "vercel.json");
    expect(fs.existsSync(vercelJsonPath)).toBe(true);

    const content = fs.readFileSync(vercelJsonPath, "utf-8");
    const parsed = JSON.parse(content);

    expect(Array.isArray(parsed.crons)).toBe(true);
    expect(parsed.crons.length).toBeGreaterThanOrEqual(1);

    const cronTick = parsed.crons.find((c: { path: string }) => c.path === "/api/cron/tick");
    expect(cronTick).toBeDefined();
    expect(cronTick.schedule).toBeDefined();
    expect(typeof cronTick.schedule).toBe("string");
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
      "Vercel Cron Setup",
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
