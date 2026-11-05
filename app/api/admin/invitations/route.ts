import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { getInvitationSummary } from "@/lib/invitation-service";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { wedding } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "VIEWER");

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || "all";
    const accessLevelId = searchParams.get("accessLevelId") || "";
    const senderId = searchParams.get("senderId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    // Build filter
    const where: Prisma.GuestWhereInput = {
      weddingId: wedding.id,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { city: { contains: search, mode: "insensitive" } },
        { group: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status !== "all") {
      if (status === "unassigned_sender") {
        where.senderId = null;
      } else {
        where.inviteStatus = status as Prisma.EnumInviteStatusFilter;
      }
    }

    if (accessLevelId === "none") {
      where.accessLevelId = null;
    } else if (accessLevelId) {
      where.accessLevelId = accessLevelId;
    }

    if (senderId === "none") {
      where.senderId = null;
    } else if (senderId) {
      where.senderId = senderId;
    }

    // Parallel fetch: summary, paginated guests, total count, access levels, senders
    const [summary, totalCount, guests, accessLevels, senders] = await Promise.all([
      getInvitationSummary(wedding.id),
      prisma.guest.count({ where }),
      prisma.guest.findMany({
        where,
        include: {
          accessLevel: {
            select: { id: true, name: true },
          },
          sender: {
            select: { id: true, name: true, phone: true },
          },
          messageLogs: {
            where: { templateKey: "invitation", kind: "template" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              sentAt: true,
              errorMessage: true,
              attempts: true,
            },
          },
        },
        orderBy: [{ inviteStatus: "asc" }, { name: "asc" }],
        skip,
        take: limit,
      }),
      prisma.accessLevel.findMany({
        where: { weddingId: wedding.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.sender.findMany({
        where: { weddingId: wedding.id, revokedAt: null },
        select: {
          id: true,
          name: true,
          _count: { select: { guests: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const formattedGuests = guests.map((g) => ({
      id: g.id,
      name: g.name,
      phone: g.phone,
      city: g.city,
      group: g.group,
      pax: g.pax,
      language: g.language,
      code: g.code,
      token: g.token,
      inviteStatus: g.inviteStatus,
      optedOut: g.optedOut,
      viewedAt: g.viewedAt,
      openCount: g.openCount,
      accessLevel: g.accessLevel,
      sender: g.sender,
      latestLog: g.messageLogs[0] || null,
    }));

    return NextResponse.json({
      summary,
      guests: formattedGuests,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      accessLevels,
      senders,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

