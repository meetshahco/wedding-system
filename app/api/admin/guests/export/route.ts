import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { getInviteUrl } from "@/lib/url-builder";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
  try {
    const { wedding, scoped } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const [guests, baseUrlSetting] = await Promise.all([
      scoped.guest.findMany({
        include: {
          accessLevel: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
      scoped.setting.findUnique("baseUrl"),
    ]) as [
      Array<{
        name: string;
        phone: string;
        city: string;
        pax: number;
        token: string;
        code: string;
        inviteStatus: string;
        accessLevel: { name: string } | null;
      }>,
      { key: string; value: string } | null
    ];

    const baseUrl = baseUrlSetting?.value || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const rows = guests.map((g) => ({
      Name: g.name,
      Phone: g.phone,
      City: g.city || "",
      Pax: g.pax,
      "Access Level": g.accessLevel?.name || "Unassigned",
      "Invite Status": g.inviteStatus,
      "4-Digit Code": g.code,
      "Invite Link": getInviteUrl({ token: g.token }, wedding, baseUrl),
    }));

    const csv = Papa.unparse(rows);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wedding-guests-${wedding.slug}.csv"`,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
