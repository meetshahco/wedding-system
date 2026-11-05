import { NextRequest, NextResponse } from "next/server";
import { prisma, ensurePragmas } from "@/lib/prisma";
import { UpdateGuestSchema } from "@/lib/zod-schemas";
import { normalisePhone } from "@/lib/phone";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensurePragmas();
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = UpdateGuestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { name, phone, city, pax } = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (name !== undefined) updateData.name = name;
  if (city !== undefined) updateData.city = city;
  if (pax !== undefined) updateData.pax = pax;

  if (phone !== undefined) {
    const normalised = normalisePhone(phone);
    if (!normalised) {
      return NextResponse.json(
        { error: "Invalid phone number format." },
        { status: 400 }
      );
    }

    // Check if phone is taken by another guest
    const existing = await prisma.guest.findUnique({
      where: { phone: normalised },
    });
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: `Phone ${normalised} is already used by ${existing.name}.` },
        { status: 409 }
      );
    }
    updateData.phone = normalised;
  }

  // Also support updating accessLevelId directly if passed in body
  if (body?.accessLevelId !== undefined) {
    updateData.accessLevelId = body.accessLevelId || null;
  }

  try {
    const updated = await prisma.guest.update({
      where: { id },
      data: updateData,
      include: { accessLevel: true },
    });
    return NextResponse.json({ guest: updated });
  } catch {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensurePragmas();
  const { id } = await params;

  try {
    await prisma.guest.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }
}

