import { NextRequest, NextResponse } from "next/server";
import { getWeddingContext } from "@/lib/wedding-context";
import { requireWeddingAccess } from "@/lib/auth";
import { UpdateGuestSchema } from "@/lib/zod-schemas";
import { normalisePhone } from "@/lib/phone";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { wedding, scoped } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "MANAGER");
    const { id } = await params;

    // Verify guest belongs to this wedding
    const guest = (await scoped.guest.findFirst({
      where: { id },
    })) as { id: string; name: string } | null;

    if (!guest) {
      return NextResponse.json({ error: "Guest not found in this wedding" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateGuestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { name, phone, city, pax, accessLevelId } = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (city !== undefined) updateData.city = city;
    if (pax !== undefined) updateData.pax = pax;
    if (accessLevelId !== undefined) updateData.accessLevelId = accessLevelId || null;

    if (phone !== undefined) {
      const normalised = normalisePhone(phone);
      if (!normalised) {
        return NextResponse.json(
          { error: "Invalid phone number format." },
          { status: 400 }
        );
      }

      // Check if phone is taken by another guest in THIS wedding
      const existing = (await scoped.guest.findFirst({
        where: { phone: normalised },
      })) as { id: string; name: string } | null;

      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: `Phone ${normalised} is already used by ${existing.name} in this wedding.` },
          { status: 409 }
        );
      }
      updateData.phone = normalised;
    }

    const updated = await scoped.guest.update({
      where: { id },
      data: updateData,
      include: { accessLevel: true },
    });
    return NextResponse.json({ guest: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to update guest" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { wedding, scoped } = await getWeddingContext(req);
    await requireWeddingAccess(wedding.id, "MANAGER");
    const { id } = await params;

    // Verify guest belongs to this wedding
    const guest = await scoped.guest.findFirst({ where: { id } });
    if (!guest) {
      return NextResponse.json({ error: "Guest not found in this wedding" }, { status: 404 });
    }

    await scoped.guest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHENTICATED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err.message === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: "Failed to delete guest" }, { status: 500 });
  }
}
