import { NextRequest, NextResponse } from "next/server";
import { prisma, ensurePragmas } from "@/lib/prisma";
import { validateImportRows, RawImportRow, ValidatedGuestRow } from "@/lib/import-validation";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  await ensurePragmas();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Missing request body" }, { status: 400 });
  }

  const { action, rawRows, validRowsToImport } = body;

  if (action === "validate") {
    if (!Array.isArray(rawRows)) {
      return NextResponse.json({ error: "rawRows must be an array" }, { status: 400 });
    }

    // Fetch all existing guest phones from DB to detect collisions
    const existingGuests = await prisma.guest.findMany({ select: { phone: true } });
    const existingPhones = new Set(existingGuests.map((g) => g.phone));

    const result = validateImportRows(rawRows as RawImportRow[], existingPhones);
    return NextResponse.json(result);
  }

  if (action === "import") {
    if (!Array.isArray(validRowsToImport) || validRowsToImport.length === 0) {
      return NextResponse.json(
        { error: "validRowsToImport must be a non-empty array" },
        { status: 400 }
      );
    }

    const rows = validRowsToImport as ValidatedGuestRow[];

    // Load existing codes to guarantee uniqueness across new items
    const existing = await prisma.guest.findMany({
      select: { code: true, token: true, phone: true },
    });
    const usedCodes = new Set(existing.map((g) => g.code));
    const usedTokens = new Set(existing.map((g) => g.token));
    const usedPhones = new Set(existing.map((g) => g.phone));

    const createdGuests = [];

    for (const r of rows) {
      if (usedPhones.has(r.phone)) {
        continue; // skip if added in the meantime
      }

      // Generate 10-char URL-safe token
      let token: string;
      do {
        token = crypto.randomBytes(8).toString("base64url").slice(0, 10);
      } while (usedTokens.has(token));
      usedTokens.add(token);

      // Generate 4-digit code
      let code: string;
      do {
        code = String(Math.floor(Math.random() * 9000) + 1000);
      } while (usedCodes.has(code));
      usedCodes.add(code);

      const guest = await prisma.guest.create({
        data: {
          name: r.name,
          phone: r.phone,
          city: r.city || "",
          pax: r.pax || 1,
          token,
          code,
        },
      });

      usedPhones.add(r.phone);
      createdGuests.push(guest);
    }

    return NextResponse.json({
      success: true,
      importedCount: createdGuests.length,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

