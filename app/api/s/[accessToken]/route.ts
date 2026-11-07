import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ManualLinkProvider } from "@/lib/providers/manual-link-provider";
import { resolveTemplateForGuest, DEFAULT_TEMPLATES } from "@/lib/template-renderer";
import { getInviteUrl } from "@/lib/url-builder";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ accessToken: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { accessToken } = await params;

    const sender = await prisma.sender.findUnique({
      where: { accessToken },
      include: {
        wedding: true,
      },
    });

    if (!sender) {
      return NextResponse.json({ error: "Sender link not found" }, { status: 404 });
    }

    if (sender.revokedAt) {
      return NextResponse.json(
        { error: "This sender link has been revoked. Please ask the couple for a new link.", revoked: true },
        { status: 403 }
      );
    }

    if (sender.expiresAt && sender.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This sender link has expired. Please ask the couple for a refreshed link.", expired: true },
        { status: 403 }
      );
    }

    // Check if sender is locked out due to previous failed PIN attempts
    if (sender.lockedUntil && sender.lockedUntil > new Date()) {
      const remainingSeconds = Math.ceil((sender.lockedUntil.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Sender portal is temporarily locked due to repeated incorrect PIN attempts. Please try again in ${remainingSeconds} seconds.`,
          locked: true,
          lockedUntil: sender.lockedUntil,
        },
        { status: 423 }
      );
    }

    // PIN check if configured on sender
    if (sender.pin) {
      const pinHeader = req.headers.get("x-sender-pin");
      const pinParam = req.nextUrl.searchParams.get("pin");
      const enteredPin = (pinHeader || pinParam || "").trim();

      if (!enteredPin) {
        return NextResponse.json(
          { pinRequired: true, senderName: sender.name, coupleNames: `${sender.wedding.coupleName1} & ${sender.wedding.coupleName2}` },
          { status: 401 }
        );
      }

      // Shared DB rate limiting: 5 PIN attempts per 15 minutes per IP + Sender
      const clientIp =
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";
      const rateLimitKey = `${sender.id}:${clientIp}`;

      const { allowed, resetAt } = await checkRateLimit(
        rateLimitKey,
        "sender_pin",
        5,
        15 * 60 * 1000
      );

      if (!allowed) {
        return NextResponse.json(
          {
            error: `Too many PIN attempts. Please try again after ${resetAt.toLocaleTimeString()}.`,
            rateLimited: true,
          },
          { status: 429 }
        );
      }

      if (enteredPin !== sender.pin) {
        const attempts = (sender.failedPinAttempts || 0) + 1;
        const willLock = attempts >= 5;
        const lockDuration = 15 * 60 * 1000;
        const lockedUntil = willLock ? new Date(Date.now() + lockDuration) : null;

        await prisma.sender.update({
          where: { id: sender.id },
          data: {
            failedPinAttempts: attempts,
            lockedUntil,
          },
        });

        if (willLock) {
          return NextResponse.json(
            {
              error: "Sender portal locked for 15 minutes due to 5 consecutive failed PIN attempts.",
              locked: true,
            },
            { status: 423 }
          );
        }

        return NextResponse.json(
          {
            error: `Incorrect PIN. ${Math.max(0, 5 - attempts)} attempt(s) remaining before lockout.`,
            pinRequired: true,
          },
          { status: 401 }
        );
      }

      // PIN is valid: reset failed attempts and lockout
      if (sender.failedPinAttempts > 0 || sender.lockedUntil) {
        await prisma.sender.update({
          where: { id: sender.id },
          data: {
            failedPinAttempts: 0,
            lockedUntil: null,
          },
        });
      }
    }

    const reminderId = req.nextUrl.searchParams.get("reminderId");

    // Fetch active message rounds/reminders for this wedding
    const activeReminders = await prisma.reminder.findMany({
      where: {
        weddingId: sender.weddingId,
        status: { in: ["scheduled", "running", "done"] },
      },
      select: { id: true, title: true, templateKey: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    let currentTemplateKey = "invitation";
    let activeReminderTitle = "Wedding Invitations";

    if (reminderId) {
      const selectedReminder = activeReminders.find((r) => r.id === reminderId);
      if (selectedReminder) {
        currentTemplateKey = selectedReminder.templateKey;
        activeReminderTitle = selectedReminder.title;
      }
    }

    // Sender only sees their own assigned guests!
    const guests = await prisma.guest.findMany({
      where: {
        weddingId: sender.weddingId,
        senderId: sender.id,
      },
      include: {
        accessLevel: true,
        messageLogs: reminderId
          ? {
              where: { reminderId },
              orderBy: { createdAt: "desc" },
              take: 1,
            }
          : undefined,
      },
      orderBy: [{ inviteStatus: "asc" }, { name: "asc" }],
    });

    const coupleNames = `${sender.wedding.coupleName1} & ${sender.wedding.coupleName2}`;
    const formattedDate = new Date(sender.wedding.weddingDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Resolve template and render messages for each guest
    const guestItems = await Promise.all(
      guests.map(async (g) => {
        const template = await resolveTemplateForGuest(sender.weddingId, currentTemplateKey, g.language);
        const defaultBody = template?.body || DEFAULT_TEMPLATES[0].body;

        const inviteUrl = getInviteUrl(g, sender.wedding);

        const renderedMessage = ManualLinkProvider.renderMessage(
          defaultBody,
          {
            guest_name: g.name,
            couple_names: coupleNames,
            wedding_date: formattedDate,
            pax: g.pax,
            code: g.code,
            invite_url: inviteUrl,
            access_level: g.accessLevel?.name || "All Events",
          },
          reminderId ? null : sender.messageOverride
        );

        const waMeUrl = ManualLinkProvider.generateWhatsAppUrl(g.phone, renderedMessage);

        const effectiveStatus = reminderId && g.messageLogs?.[0]
          ? g.messageLogs[0].status
          : g.inviteStatus;

        return {
          id: g.id,
          name: g.name,
          phone: g.phone,
          city: g.city,
          group: g.group,
          pax: g.pax,
          code: g.code,
          inviteStatus: effectiveStatus,
          message: renderedMessage,
          waMeUrl,
          inviteUrl,
        };
      })
    );

    const sentCount = guestItems.filter((g) => g.inviteStatus === "sent" || g.inviteStatus === "delivered" || g.inviteStatus === "read").length;

    return NextResponse.json({
      sender: {
        id: sender.id,
        name: sender.name,
        hasPin: Boolean(sender.pin),
        messageOverride: sender.messageOverride,
      },
      wedding: {
        id: sender.wedding.id,
        coupleNames,
        weddingDate: sender.wedding.weddingDate,
        accentColor: sender.wedding.accentColor,
      },
      rounds: [
        { id: "", title: "Wedding Invitations", isDefault: true },
        ...activeReminders.map((r) => ({ id: r.id, title: r.title, isDefault: false })),
      ],
      activeRound: {
        id: reminderId || "",
        title: activeReminderTitle,
      },
      guests: guestItems,
      stats: {
        total: guestItems.length,
        sent: sentCount,
        pending: guestItems.length - sentCount,
      },
    });
  } catch (error) {
    console.error("Sender route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

