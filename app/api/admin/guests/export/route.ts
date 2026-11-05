import { NextResponse } from "next/server";
import { prisma, ensurePragmas } from "@/lib/prisma";
import Papa from "papaparse";

export async function GET() {
  await ensurePragmas();

  const [guests, baseUrlSetting] = await Promise.all([
    prisma.guest.findMany({
      include: {
        accessLevel: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({
      where: { key: "baseUrl" },
    }),
  ]);

  const baseUrl = (baseUrlSetting?.value || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

  const rows = guests.map((g) => ({
    Name: g.name,
    Phone: g.phone,
    City: g.city || "",
    Pax: g.pax,
    "Access Level": g.accessLevel?.name || "Unassigned",
    "Invite Status": g.inviteStatus,
    "4-Digit Code": g.code,
    "Invite Link": `${baseUrl}/i/${g.token}`,
  }));

  const csv = Papa.unparse(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wedding-guests-links-codes.csv"',
    },
  });
}

