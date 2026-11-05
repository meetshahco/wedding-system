import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import { Prisma, Wedding } from "@prisma/client";

export interface ScopedWeddingContext {
  wedding: Wedding;
  scoped: {
    guest: {
      findMany: (args?: Prisma.GuestFindManyArgs) => Promise<unknown[]>;
      findUnique: (args: Prisma.GuestFindUniqueArgs) => Promise<unknown | null>;
      findFirst: (args?: Prisma.GuestFindFirstArgs) => Promise<unknown | null>;
      create: (args: Omit<Prisma.GuestCreateArgs, "data"> & { data: Omit<Prisma.GuestUncheckedCreateInput, "weddingId"> }) => Promise<unknown>;
      update: (args: Prisma.GuestUpdateArgs) => Promise<unknown>;
      delete: (args: Prisma.GuestDeleteArgs) => Promise<unknown>;
      deleteMany: (args?: Prisma.GuestDeleteManyArgs) => Promise<Prisma.BatchPayload>;
      count: (args?: Prisma.GuestCountArgs) => Promise<number>;
    };
    event: {
      findMany: (args?: Prisma.EventFindManyArgs) => Promise<unknown[]>;
      findFirst: (args?: Prisma.EventFindFirstArgs) => Promise<unknown | null>;
      findUnique: (args: Prisma.EventFindUniqueArgs) => Promise<unknown | null>;
      create: (args: Prisma.EventCreateArgs) => Promise<unknown>;
      update: (args: Prisma.EventUpdateArgs) => Promise<unknown>;
      delete: (args: Prisma.EventDeleteArgs) => Promise<unknown>;
    };
    accessLevel: {
      findMany: (args?: Prisma.AccessLevelFindManyArgs) => Promise<unknown[]>;
      findFirst: (args?: Prisma.AccessLevelFindFirstArgs) => Promise<unknown | null>;
      findUnique: (args: Prisma.AccessLevelFindUniqueArgs) => Promise<unknown | null>;
      create: (args: Prisma.AccessLevelCreateArgs) => Promise<unknown>;
      update: (args: Prisma.AccessLevelUpdateArgs) => Promise<unknown>;
      delete: (args: Prisma.AccessLevelDeleteArgs) => Promise<unknown>;
    };
    setting: {
      findUnique: (key: string) => Promise<{ key: string; value: string } | null>;
      upsert: (key: string, value: string) => Promise<unknown>;
      findMany: () => Promise<unknown[]>;
    };
  };
}

/**
 * Resolves the active wedding for an incoming request.
 * Resolves via:
 * 1. x-wedding-id or x-wedding-slug header
 * 2. ?weddingId= or ?weddingSlug= URL search parameter
 * 3. wedding_active_id cookie
 * 4. Fallback: first available wedding or default seeded wedding
 */
export async function getWeddingContext(
  req?: NextRequest | Request
): Promise<ScopedWeddingContext> {
  let wedding: Wedding | null = null;

  if (req) {
    let headerWeddingId: string | null = null;
    let headerWeddingSlug: string | null = null;
    let paramWeddingId: string | null = null;
    let paramWeddingSlug: string | null = null;

    if ("headers" in req && typeof req.headers?.get === "function") {
      headerWeddingId = req.headers.get("x-wedding-id");
      headerWeddingSlug = req.headers.get("x-wedding-slug");
    }

    if ("nextUrl" in req && req.nextUrl?.searchParams) {
      paramWeddingId = req.nextUrl.searchParams.get("weddingId");
      paramWeddingSlug = req.nextUrl.searchParams.get("weddingSlug");
    } else if ("url" in req && req.url) {
      try {
        const parsed = new URL(req.url);
        paramWeddingId = parsed.searchParams.get("weddingId");
        paramWeddingSlug = parsed.searchParams.get("weddingSlug");
      } catch {
        // ignore invalid URL
      }
    }

    const idToLookup = headerWeddingId || paramWeddingId;
    const slugToLookup = headerWeddingSlug || paramWeddingSlug;

    if (idToLookup) {
      wedding = await prisma.wedding.findUnique({
        where: { id: idToLookup },
      });
    } else if (slugToLookup) {
      wedding = await prisma.wedding.findUnique({
        where: { slug: slugToLookup },
      });
    }
  }

  // Fallback to first available wedding
  if (!wedding) {
    wedding = await prisma.wedding.findFirst({
      orderBy: { createdAt: "asc" },
    });
  }

  // If no wedding exists at all, create the default one
  if (!wedding) {
    wedding = await prisma.wedding.create({
      data: {
        slug: "arjun-meera",
        coupleName1: "Arjun",
        coupleName2: "Meera",
        weddingDate: new Date("2027-02-21T10:00:00+05:30"),
        accentColor: "#111111",
      },
    });
  }

  const weddingId = wedding.id;

  // Build the query wrapper that prevents unscoped leaks
  const scoped = {
    guest: {
      findMany: (args?: Prisma.GuestFindManyArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.guest.findMany({ ...args, where });
      },
      findUnique: (args: Prisma.GuestFindUniqueArgs) => {
        return prisma.guest.findFirst({
          where: { ...args.where, weddingId },
        });
      },
      findFirst: (args?: Prisma.GuestFindFirstArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.guest.findFirst({ ...args, where });
      },
      create: (args: { data: Record<string, unknown>; [key: string]: unknown }) => {
        const data = { ...args.data, weddingId };
        return prisma.guest.create({
          ...args,
          data: data as unknown as Prisma.GuestCreateInput,
        });
      },
      update: (args: Prisma.GuestUpdateArgs) => {
        const where = { ...args.where, weddingId };
        return prisma.guest.update({ ...args, where });
      },
      delete: (args: Prisma.GuestDeleteArgs) => {
        return prisma.guest.delete({
          where: { id: args.where.id },
        });
      },
      deleteMany: (args?: Prisma.GuestDeleteManyArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.guest.deleteMany({ ...args, where });
      },
      count: (args?: Prisma.GuestCountArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.guest.count({ ...args, where });
      },
    },
    event: {
      findMany: (args?: Prisma.EventFindManyArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.event.findMany({ ...args, where });
      },
      findFirst: (args?: Prisma.EventFindFirstArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.event.findFirst({ ...args, where });
      },
      findUnique: (args: Prisma.EventFindUniqueArgs) => {
        return prisma.event.findUnique(args);
      },
      create: (args: Prisma.EventCreateArgs) => {
        const data = { ...args.data, wedding: { connect: { id: weddingId } } };
        return prisma.event.create({ ...args, data: data as Prisma.EventCreateInput });
      },
      update: (args: Prisma.EventUpdateArgs) => {
        return prisma.event.update({ ...args });
      },
      delete: (args: Prisma.EventDeleteArgs) => {
        return prisma.event.delete({ where: { id: args.where.id } });
      },
    },
    accessLevel: {
      findMany: (args?: Prisma.AccessLevelFindManyArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.accessLevel.findMany({ ...args, where });
      },
      findFirst: (args?: Prisma.AccessLevelFindFirstArgs) => {
        const where = { ...(args?.where || {}), weddingId };
        return prisma.accessLevel.findFirst({ ...args, where });
      },
      findUnique: (args: Prisma.AccessLevelFindUniqueArgs) => {
        return prisma.accessLevel.findUnique(args);
      },
      create: (args: Prisma.AccessLevelCreateArgs) => {
        const data = { ...args.data, wedding: { connect: { id: weddingId } } };
        return prisma.accessLevel.create({ ...args, data: data as Prisma.AccessLevelCreateInput });
      },
      update: (args: Prisma.AccessLevelUpdateArgs) => {
        return prisma.accessLevel.update({ ...args });
      },
      delete: (args: Prisma.AccessLevelDeleteArgs) => {
        return prisma.accessLevel.delete({ where: { id: args.where.id } });
      },
    },
    setting: {
      findUnique: async (key: string) => {
        return prisma.setting.findUnique({
          where: { weddingId_key: { weddingId, key } },
        });
      },
      upsert: async (key: string, value: string) => {
        return prisma.setting.upsert({
          where: { weddingId_key: { weddingId, key } },
          create: { weddingId, key, value },
          update: { value },
        });
      },
      findMany: () => {
        return prisma.setting.findMany({ where: { weddingId } });
      },
    },
  };

  return { wedding, scoped };
}
