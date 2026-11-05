import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    const { session } = await requireWeddingAccess(wedding.id, "MANAGER");

    const wDate = new Date(wedding.weddingDate);

    // Seed inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Events
      const e1 = await tx.event.create({
        data: {
          weddingId: wedding.id,
          name: "Mehendi Ceremony",
          date: new Date(wDate.getTime() - 2 * 24 * 60 * 60 * 1000),
          startTime: "4:00 PM",
          venue: "Garden Pavilion",
          address: "123 Celebration Way, Royal Estate",
          dressCode: "Colourful / Festive",
          description: "Join us for afternoon henna, folk music, and high tea.",
          sortOrder: 1,
        },
      });

      const e2 = await tx.event.create({
        data: {
          weddingId: wedding.id,
          name: "Sangeet & Cocktail Night",
          date: new Date(wDate.getTime() - 1 * 24 * 60 * 60 * 1000),
          startTime: "7:00 PM",
          venue: "Grand Ballroom",
          address: "123 Celebration Way, Royal Estate",
          dressCode: "Indo-Western / Glam",
          description: "An evening of dance performances, music, and dinner.",
          sortOrder: 2,
        },
      });

      const e3 = await tx.event.create({
        data: {
          weddingId: wedding.id,
          name: "Wedding Ceremony",
          date: wDate,
          startTime: "10:00 AM",
          venue: "Temple Courtyard",
          address: "123 Celebration Way, Royal Estate",
          dressCode: "Traditional Indian",
          description: "The traditional wedding rituals followed by lunch.",
          sortOrder: 3,
        },
      });

      const e4 = await tx.event.create({
        data: {
          weddingId: wedding.id,
          name: "Reception Dinner",
          date: wDate,
          startTime: "7:30 PM",
          venue: "Royal Palace Hall",
          address: "123 Celebration Way, Royal Estate",
          dressCode: "Formal / Black Tie",
          description: "Celebratory banquet, toasts, and dancing with the newlyweds.",
          sortOrder: 4,
        },
      });

      // Create Access Levels if they don't exist
      let alAll = await tx.accessLevel.findUnique({
        where: { weddingId_name: { weddingId: wedding.id, name: "All Events" } },
      });
      if (!alAll) {
        alAll = await tx.accessLevel.create({
          data: { weddingId: wedding.id, name: "All Events" },
        });
      }

      let alWeddingReception = await tx.accessLevel.findUnique({
        where: { weddingId_name: { weddingId: wedding.id, name: "Wedding & Reception" } },
      });
      if (!alWeddingReception) {
        alWeddingReception = await tx.accessLevel.create({
          data: { weddingId: wedding.id, name: "Wedding & Reception" },
        });
      }

      let alReceptionOnly = await tx.accessLevel.findUnique({
        where: { weddingId_name: { weddingId: wedding.id, name: "Reception Only" } },
      });
      if (!alReceptionOnly) {
        alReceptionOnly = await tx.accessLevel.create({
          data: { weddingId: wedding.id, name: "Reception Only" },
        });
      }

      // Link events to access levels
      await tx.accessLevelEvent.createMany({
        data: [
          // All events
          { accessLevelId: alAll.id, eventId: e1.id },
          { accessLevelId: alAll.id, eventId: e2.id },
          { accessLevelId: alAll.id, eventId: e3.id },
          { accessLevelId: alAll.id, eventId: e4.id },
          // Wedding & Reception
          { accessLevelId: alWeddingReception.id, eventId: e3.id },
          { accessLevelId: alWeddingReception.id, eventId: e4.id },
          // Reception only
          { accessLevelId: alReceptionOnly.id, eventId: e4.id },
        ],
        skipDuplicates: true,
      });

      return {
        events: [e1, e2, e3, e4],
        accessLevels: [alAll, alWeddingReception, alReceptionOnly],
      };
    });

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "EVENTS_TEMPLATE_LOADED",
      details: { eventCount: result.events.length, accessLevelCount: result.accessLevels.length },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

