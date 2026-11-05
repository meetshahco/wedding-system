import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    const wedding = await prisma.wedding.findFirst({
      where: { slug: { equals: slug, mode: "insensitive" } },
    });

    if (!wedding) {
      return NextResponse.json(
        { error: "Wedding not found. Please check your invitation link." },
        { status: 404 }
      );
    }

    // Rate limit per IP and wedding: 5 attempts per 15 minutes
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const rateResult = await checkRateLimit(
      `${wedding.id}:${clientIp}`,
      "code_entry",
      5,
      15 * 60 * 1000
    );

    if (!rateResult.allowed) {
      return NextResponse.json(
        {
          error: "Too many attempts. For security, please wait 15 minutes before trying again.",
          rateLimited: true,
        },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    if (!code || !/^\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: "Please enter a valid 4-digit code." },
        { status: 400 }
      );
    }

    const guest = await prisma.guest.findFirst({
      where: {
        weddingId: wedding.id,
        code,
      },
      select: {
        id: true,
        token: true,
      },
    });

    if (!guest) {
      return NextResponse.json(
        {
          error: "Invalid invitation code. Please check your card or message.",
          remaining: rateResult.remaining,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      token: guest.token,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
