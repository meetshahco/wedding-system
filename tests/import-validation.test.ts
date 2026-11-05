import { describe, it, expect } from "vitest";
import { validateImportRows } from "@/lib/import-validation";

describe("validateImportRows", () => {
  it("validates clean rows successfully", () => {
    const existing = new Set<string>();
    const rows = [
      { name: "John Doe", phone: "9876543210", city: "Mumbai", pax: "2" },
      { name: "Jane Smith", phone: "+919876543211", city: "Delhi", pax: 1 },
    ];

    const result = validateImportRows(rows, existing);
    expect(result.validRows.length).toBe(2);
    expect(result.invalidRows.length).toBe(0);
    expect(result.validRows[0].phone).toBe("+919876543210");
    expect(result.validRows[0].pax).toBe(2);
  });

  it("flags missing name, invalid phone, and invalid pax", () => {
    const existing = new Set<string>();
    const rows = [
      { name: "", phone: "9876543210", city: "Mumbai", pax: 1 },
      { name: "Alice", phone: "12345", city: "Pune", pax: 1 },
      { name: "Bob", phone: "9876543212", city: "Goa", pax: -1 },
    ];

    const result = validateImportRows(rows, existing);
    expect(result.validRows.length).toBe(0);
    expect(result.invalidRows.length).toBe(3);
    expect(result.invalidRows[0].errors).toContain("Missing name");
    expect(result.invalidRows[1].errors[0]).toMatch(/Invalid phone/);
    expect(result.invalidRows[2].errors).toContain("Pax must be at least 1");
  });

  it("detects duplicates within the file", () => {
    const existing = new Set<string>();
    const rows = [
      { name: "Person A", phone: "9876543210", city: "Mumbai" },
      { name: "Person B", phone: "+919876543210", city: "Delhi" },
    ];

    const result = validateImportRows(rows, existing);
    expect(result.validRows.length).toBe(1);
    expect(result.invalidRows.length).toBe(1);
    expect(result.invalidRows[0].errors[0]).toMatch(/Duplicate phone number in file/);
  });

  it("detects duplicates already in database", () => {
    const existing = new Set(["+919876543210"]);
    const rows = [
      { name: "Person C", phone: "9876543210", city: "Mumbai" },
    ];

    const result = validateImportRows(rows, existing);
    expect(result.validRows.length).toBe(0);
    expect(result.invalidRows.length).toBe(1);
    expect(result.invalidRows[0].errors[0]).toMatch(/Phone number already exists in database/);
  });
});

