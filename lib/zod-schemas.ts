import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const LoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

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
