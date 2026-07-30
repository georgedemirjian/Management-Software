import { z } from "zod";

/**
 * Shared validation primitives for domain input schemas.
 *
 * Conventions (see prisma/schema.prisma header):
 * - Input schemas are z.strictObject — unknown keys are rejected.
 * - Input schemas NEVER include organizationId, ids, or timestamps; the
 *   server injects the organization from the active session and the
 *   database generates the rest.
 * - Money is integer cents. Civil dates (lease terms, due dates) travel as
 *   "YYYY-MM-DD" strings and map to Prisma @db.Date columns.
 */

export const idSchema = z.string().min(1).max(64);

/** Monetary amount in integer cents; zero allowed (e.g. no deposit). */
export const centsSchema = z
  .number()
  .int("Money must be integer cents")
  .min(0)
  .max(2_000_000_000); // < 2^31, keeps Postgres Int happy

/** Monetary amount that must be positive (charges, payments). */
export const positiveCentsSchema = centsSchema.refine((v) => v > 0, {
  message: "Amount must be greater than zero",
});

/** Civil date without time: "YYYY-MM-DD". */
export const isoDateSchema = z.iso.date();

/**
 * Day of month billing falls due, capped at 28 so the day exists in every
 * month — no February surprises.
 */
export const dueDaySchema = z.number().int().min(1).max(28);

/** Optional free-form text; empty strings normalize to undefined. */
export const optionalTextSchema = z
  .string()
  .trim()
  .max(2000)
  .transform((v) => (v === "" ? undefined : v))
  .optional();

/** Required short human label (names, titles). */
export const labelSchema = z.string().trim().min(1).max(200);
