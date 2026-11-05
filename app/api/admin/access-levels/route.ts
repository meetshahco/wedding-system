import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";

export async function GET(req: NextRequest) {
  const { scoped } = await getWeddingContext(req);

  const accessLevels = await scoped.accessLevel.findMany({
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
