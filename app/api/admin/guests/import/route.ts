import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { validateImportRows, RawImportRow, ValidatedGuestRow } from "@/lib/import-validation";
import { generateUniqueToken, generateUniqueCode } from "@/lib/token";

export async function POST(req: NextRequest) {
  try {
    const { wedding, scoped } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "MANAGER");

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

      // Load existing phones in this wedding
      const existingInWedding = (await scoped.guest.findMany({
        select: { phone: true },
      })) as Array<{ phone: string }>;

      const usedPhones = new Set(existingInWedding.map((g) => g.phone));
      const createdGuests = [];

      for (const r of rows) {
        if (usedPhones.has(r.phone)) {
          continue; // skip duplicate in wedding
        }

        const [token, code] = await Promise.all([
          generateUniqueToken(),
          generateUniqueCode(wedding.id),
        ]);

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
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
