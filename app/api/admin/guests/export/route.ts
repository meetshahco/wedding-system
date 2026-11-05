import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { getInviteUrl } from "@/lib/url-builder";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
  const { wedding, scoped } = await getWeddingContext(req);

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
}
