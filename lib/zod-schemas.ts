import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth & Users
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const InviteUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  targetRole: z.enum(["OWNER", "MANAGER", "USER"]).default("USER"),
  weddingId: z.string().nullable().optional(),
  weddingRole: z.enum(["MANAGER", "VIEWER"]).default("VIEWER"),
});

export const AcceptInviteSchema = z.object({
  token: z.string().min(1, "Invite token is required"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const UpdateUserStatusSchema = z.object({
  isActive: z.boolean().optional(),
  globalRole: z.enum(["OWNER", "MANAGER", "USER"]).optional(),
  weddingId: z.string().optional(),
  weddingRole: z.enum(["MANAGER", "VIEWER"]).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Weddings
// ---------------------------------------------------------------------------

export const CreateWeddingSchema = z.object({
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  coupleName1: z.string().min(1, "Partner 1 name is required").max(100),
  coupleName2: z.string().min(1, "Partner 2 name is required").max(100),
  weddingDate: z.string().min(1, "Wedding date is required"),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color (e.g. #111111)")
    .optional()
    .default("#111111"),
  startFromTemplate: z.boolean().optional().default(true),
});

export const UpdateWeddingSchema = CreateWeddingSchema.partial();

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export const CreateGuestSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phone: z.string().min(1, "Phone is required"),
  city: z.string().max(100).optional().default(""),
  pax: z.coerce.number().int().min(1).max(100).optional().default(1),
  accessLevelId: z.string().nullable().optional(),
});

export const UpdateGuestSchema = CreateGuestSchema.partial();

export const BulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const UpdateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const CreateEventSchema = z.object({
  name: z.string().min(1).max(200),
  date: z.string(), // ISO date string
  startTime: z.string().min(1),
  venue: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  mapUrl: z.string().url().optional().or(z.literal("")).default(""),
  dressCode: z.string().max(200).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const UpdateEventSchema = CreateEventSchema.partial();

// ---------------------------------------------------------------------------
// Access Levels
// ---------------------------------------------------------------------------

export const CreateAccessLevelSchema = z.object({
  name: z.string().min(1).max(100),
  eventIds: z.array(z.string()).default([]),
});

export const UpdateAccessLevelSchema = CreateAccessLevelSchema.partial();
