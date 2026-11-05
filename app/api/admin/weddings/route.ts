import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { CreateWeddingSchema } from "@/lib/zod-schemas";
import { logAuditEvent } from "@/lib/audit";
import { tokens } from "@/lib/theme";

export async function GET() {
  try {
    const session = await requireAuth();

    let weddings;
    if (session.globalRole === "OWNER") {
      weddings = await prisma.wedding.findMany({
        include: {
          _count: {
            select: { guests: true, events: true },
          },
        },
        orderBy: { weddingDate: "asc" },
      });
    } else {
      const accesses = await prisma.weddingAccess.findMany({
        where: { userId: session.userId },
        include: {
          wedding: {
            include: {
              _count: {
                select: { guests: true, events: true },
              },
            },
          },
        },
      });
      weddings = accesses.map((a) => a.wedding);
    }

    return NextResponse.json({ weddings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    if (session.globalRole !== "OWNER" && session.globalRole !== "MANAGER") {
      return NextResponse.json({ error: "Only Owners and Managers can create weddings" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = CreateWeddingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { slug, coupleName1, coupleName2, weddingDate, accentColor, startFromTemplate } = parsed.data;

    // Check slug uniqueness
    const existing = await prisma.wedding.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: `A wedding with slug '${slug}' already exists` }, { status: 409 });
    }

    const wedding = await prisma.wedding.create({
      data: {
        slug,
        coupleName1,
        coupleName2,
        weddingDate: new Date(weddingDate),
        accentColor: accentColor || tokens.primary.main,
      },
    });

    // If startFromTemplate is true, seed standard events, access levels, and templates
    if (startFromTemplate) {
      const e1 = await prisma.event.create({
        data: {
          weddingId: wedding.id,
          name: "Mehendi Ceremony",
          date: new Date(wedding.weddingDate.getTime() - 2 * 24 * 60 * 60 * 1000),
          startTime: "4:00 PM",
          venue: "Garden Pavilion",
          address: "City Venue",
          dressCode: "Colourful / Festive",
          description: "Henna, music, and festivities.",
          sortOrder: 1,
        },
      });

      const e2 = await prisma.event.create({
        data: {
          weddingId: wedding.id,
          name: "Sangeet Night",
          date: new Date(wedding.weddingDate.getTime() - 1 * 24 * 60 * 60 * 1000),
          startTime: "7:30 PM",
          venue: "Grand Ballroom",
          address: "City Venue",
          dressCode: "Cocktail / Festive",
          description: "Music, performances, and celebration.",
          sortOrder: 2,
        },
      });

      const e3 = await prisma.event.create({
        data: {
          weddingId: wedding.id,
          name: "Wedding Ceremony & Reception",
          date: wedding.weddingDate,
          startTime: "10:00 AM",
          venue: "Main Hall & Lawns",
          address: "City Venue",
          dressCode: "Formal / Traditional",
          description: "Main ceremony and dinner reception.",
          sortOrder: 3,
        },
      });

      const allEvents = await prisma.accessLevel.create({
        data: {
          weddingId: wedding.id,
          name: "All events",
          events: {
            create: [{ eventId: e1.id }, { eventId: e2.id }, { eventId: e3.id }],
          },
        },
      });

      await prisma.accessLevel.create({
        data: {
          weddingId: wedding.id,
          name: "Ceremony only",
          events: {
            create: [{ eventId: e3.id }],
          },
        },
      });

      // Default templates
      const templates = [
        {
          key: "wedding_invite",
          category: "Marketing",
          body: "Dear {{1}},\n\nWe joyfully invite you to celebrate our wedding! 🎉\n\nYour personal invitation awaits at the link below. If the link doesn't open, visit our wedding site and enter your 4-digit code: {{2}}\n\nWe can't wait to celebrate with you! 💕",
          buttons: JSON.stringify([
            { type: "url", text: "Open My Invitation", url: "{{BASE_URL}}/i/{{3}}" },
            { type: "quick_reply", text: "Attending" },
            { type: "quick_reply", text: "Can't make it" },
          ]),
          sampleValues: JSON.stringify(["Guest Name", "1234", "token12345"]),
        },
        {
          key: "rsvp_reminder",
          category: "Utility",
          body: "Hi {{1}},\n\nHere is your personal invitation and event schedule for our upcoming wedding! 🙏\n\nView details at the link below, or enter your code {{2}} on our wedding site.",
          buttons: JSON.stringify([
            { type: "url", text: "View Invitation", url: "{{BASE_URL}}/i/{{3}}" },
          ]),
          sampleValues: JSON.stringify(["Guest Name", "1234", "token12345"]),
        },
      ];

      for (const t of templates) {
        await prisma.messageTemplate.create({
          data: {
            weddingId: wedding.id,
            ...t,
          },
        });
      }

      // Default settings
      await prisma.setting.createMany({
        data: [
          { weddingId: wedding.id, key: "baseUrl", value: "http://localhost:3000" },
          { weddingId: wedding.id, key: "activeProvider", value: "mock" },
          { weddingId: wedding.id, key: "dailySendCap", value: "250" },
        ],
      });
    }

    // Grant creating user manager access if not owner
    if (session.globalRole !== "OWNER") {
      await prisma.weddingAccess.create({
        data: {
          userId: session.userId,
          weddingId: wedding.id,
          role: "MANAGER",
        },
      });
    }

    await logAuditEvent({
      userId: session.userId,
      weddingId: wedding.id,
      action: "WEDDING_CREATED",
      details: { slug: wedding.slug, couple: `${wedding.coupleName1} & ${wedding.coupleName2}` },
    });

    return NextResponse.json({ wedding }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create wedding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
