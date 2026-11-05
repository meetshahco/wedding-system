import { NextResponse } from "next/server";
import { prisma, ensurePragmas } from "@/lib/prisma";

export async function GET() {
  await ensurePragmas();

  const accessLevels = await prisma.accessLevel.findMany({
    include: {
      events: {
        include: {
          event: true,
        },
      },
      _count: {
        select: { guests: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ accessLevels });
}

