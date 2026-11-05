import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { theme, tokens } from "@/lib/theme";

// Helper to recursively find all .ts/.tsx files
function getSourceFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.startsWith(".") && file !== "node_modules") {
        results = results.concat(getSourceFiles(fullPath));
      }
    } else if (file.endsWith(".tsx") || (file.endsWith(".ts") && !file.endsWith(".d.ts"))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Design System & Theme Tokens", () => {
  it("enforces black primary color (#111111) and zero purple", () => {
    expect(tokens.primary.main.toLowerCase()).toBe("#111111");
    expect(tokens.primary.contrastText.toLowerCase()).toBe("#ffffff");

    // Ensure no purple/violet tokens exist anywhere in tokens
    const jsonTokens = JSON.stringify(tokens).toLowerCase();
    expect(jsonTokens).not.toContain("#7c6b9e");
    expect(jsonTokens).not.toContain("purple");
    expect(jsonTokens).not.toContain("violet");
  });

  it("configures Inter as the typography font family and eliminates serif", () => {
    const typography = theme.typography;
    expect(typography.fontFamily).toContain("Inter");
    expect(typography.fontFamily).not.toContain("Playfair");
    expect(typography.h1.fontFamily).toContain("Inter");
    expect(typography.h1.fontFamily).not.toContain("Playfair");
  });

  it("configures 8px border radius for buttons and standard controls", () => {
    expect(theme.shape.borderRadius).toBe(8);
  });

  it("ensures NO hardcoded hex colors exist outside of lib/theme.ts in app/ and components/", () => {
    const appFiles = getSourceFiles(path.resolve(__dirname, "../app"));
    const componentFiles = getSourceFiles(path.resolve(__dirname, "../components"));
    const filesToCheck = [...appFiles, ...componentFiles];

    // Regex matching hex colors like #fff, #111111, etc.
    const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((lineText, idx) => {
        // Ignore comments or imports
        const matches = lineText.match(hexRegex);
        if (matches) {
          matches.forEach((m) => {
            violations.push({
              file: path.relative(path.resolve(__dirname, ".."), file),
              line: idx + 1,
              match: m,
            });
          });
        }
      });
    }

    expect(
      violations,
      `Found hardcoded hex colors in components/app files: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it("verifies visible focus ring styles in MuiCssBaseline and MuiButton", () => {
    const cssBaseline = theme.components?.MuiCssBaseline?.styleOverrides as Record<string, unknown>;
    expect(cssBaseline).toBeDefined();
    expect(cssBaseline["*:focus-visible"]).toEqual({
      outline: `2px solid ${tokens.primary.main}`,
      outlineOffset: "2px",
    });
  });
});
