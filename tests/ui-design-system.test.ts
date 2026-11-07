import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { theme, tokens } from "@/lib/theme";

describe("Deep UI & Design System Verification (Standard SaaS & Responsiveness)", () => {
  const rootDir = process.cwd();

  it("verifies Inter is loaded via Google Fonts CDN in globals.css and layout.tsx", () => {
    // 1. Check globals.css
    const cssPath = path.join(rootDir, "app/globals.css");
    expect(fs.existsSync(cssPath)).toBe(true);
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    expect(cssContent).toContain("https://fonts.googleapis.com/css2?family=Inter");
    expect(cssContent).toContain("font-family: 'Inter'");

    // 2. Check layout.tsx has Inter variable and font styling
    const layoutPath = path.join(rootDir, "app/layout.tsx");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");
    expect(layoutContent).toContain("inter.variable");
    expect(layoutContent).toContain("inter.className");
    expect(layoutContent).toContain("var(--font-inter)");
  });

  it("verifies that no serif fonts exist anywhere in app, components, and lib", () => {
    function scanDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (!file.startsWith(".") && file !== "node_modules") {
            results = results.concat(scanDir(fullPath));
          }
        } else if (file.endsWith(".tsx") || file.endsWith(".ts") || file.endsWith(".css")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = [
      ...scanDir(path.join(rootDir, "app")),
      ...scanDir(path.join(rootDir, "components")),
      ...scanDir(path.join(rootDir, "lib")),
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      // Check for Playfair Display or any serif declaration
      expect(content).not.toMatch(/font-family:.*['"]?Playfair/i);
      expect(content).not.toMatch(/fontFamily:.*['"]?Playfair/i);
      expect(content).not.toMatch(/['"]Playfair Display['"]/i);
    }
  });

  it("verifies AdminShell implements modern SaaS app header, mobile hamburger, and bottom navigation", () => {
    const shellPath = path.join(rootDir, "components/admin/AdminShell.tsx");
    const shellContent = fs.readFileSync(shellPath, "utf-8");

    // Has AppBar header
    expect(shellContent).toContain("<AppBar");
    // Has mobile hamburger button
    expect(shellContent).toContain("MenuIcon");
    expect(shellContent).toContain("setMobileOpen(true)");
    // Has active wedding switcher
    expect(shellContent).toContain("Active Celebration");
    // Has mobile bottom navigation with quick access
    expect(shellContent).toContain("<BottomNavigation");
    expect(shellContent).toContain("router.push(\"/admin/dashboard\")");
  });

  it("verifies mobile responsiveness and touch target compliance (min 44px)", () => {
    const buttonConfig = theme.components?.MuiButton?.styleOverrides?.root;
    // @ts-expect-error accessing style object
    expect(buttonConfig?.minHeight).toBeGreaterThanOrEqual(44);

    // Verify AdminShell tap targets
    const shellPath = path.join(rootDir, "components/admin/AdminShell.tsx");
    const shellContent = fs.readFileSync(shellPath, "utf-8");
    expect(shellContent).toContain("minHeight: 44");
  });

  it("verifies monochromatic design system palette (#111111) and zero purple", () => {
    expect(tokens.primary.main).toBe("#111111");
    expect(tokens.primary.contrastText).toBe("#FFFFFF");
    expect(tokens.neutral.bg).toBe("#FFFFFF");

    const tokensStr = JSON.stringify(tokens).toLowerCase();
    expect(tokensStr).not.toContain("purple");
    expect(tokensStr).not.toContain("violet");
    expect(tokensStr).not.toContain("#7c6b9e");
  });
});
