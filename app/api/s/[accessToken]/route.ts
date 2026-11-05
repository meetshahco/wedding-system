import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ManualLinkProvider } from "@/lib/providers/manual-link-provider";
import { resolveTemplateForGuest, DEFAULT_TEMPLATES } from "@/lib/template-renderer";
import { getInviteUrl } from "@/lib/url-builder";

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

      if (enteredPin !== sender.pin) {
        return NextResponse.json(
          { error: "Incorrect PIN. Please try again.", pinRequired: true },
          { status: 401 }
        );
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
        const template = await resolveTemplateForGuest(sender.weddingId, "invitation", g.language);
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
          sender.messageOverride
        );

        const waMeUrl = ManualLinkProvider.generateWhatsAppUrl(g.phone, renderedMessage);

        return {
          id: g.id,
          name: g.name,
          phone: g.phone,
          city: g.city,
          group: g.group,
          pax: g.pax,
          code: g.code,
          inviteStatus: g.inviteStatus,
          message: renderedMessage,
          waMeUrl,
          inviteUrl,
        };
      })
    );

    const sentCount = guestItems.filter((g) => g.inviteStatus === "sent").length;

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
