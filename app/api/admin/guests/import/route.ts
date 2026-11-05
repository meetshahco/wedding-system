import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { validateImportRows, RawImportRow, ValidatedGuestRow } from "@/lib/import-validation";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const { wedding, scoped } = await getWeddingContext(req);

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Missing request body" }, { status: 400 });
  }

  const { action, rawRows, validRowsToImport } = body;

  if (action === "validate") {
    if (!Array.isArray(rawRows)) {
      return NextResponse.json({ error: "rawRows must be an array" }, { status: 400 });
    }

    // Fetch existing phones in THIS wedding
    const existingGuests = (await scoped.guest.findMany({
      select: { phone: true },
    })) as Array<{ phone: string }>;

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

    // Load existing codes & phones in this wedding, and global tokens
    const existingInWedding = (await scoped.guest.findMany({
      select: { code: true, phone: true },
    })) as Array<{ code: string; phone: string }>;

    const usedCodes = new Set(existingInWedding.map((g) => g.code));
    const usedPhones = new Set(existingInWedding.map((g) => g.phone));

    const createdGuests = [];

    for (const r of rows) {
      if (usedPhones.has(r.phone)) {
        continue; // skip duplicate in wedding
      }

      // Generate 10-char URL-safe globally unique token
      const token = crypto.randomBytes(8).toString("base64url").slice(0, 10);

      // Generate 4-digit code unique to this wedding
      let code: string;
      do {
        code = String(Math.floor(Math.random() * 9000) + 1000);
      } while (usedCodes.has(code));
      usedCodes.add(code);

      const guest = await scoped.guest.create({
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
