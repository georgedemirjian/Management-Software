import { z } from "zod";

import {
  centsSchema,
  dueDaySchema,
  isoDateSchema,
  optionalTextSchema,
  positiveCentsSchema,
} from "@/validation/common";

/**
 * Lease lifecycle transitions. These are dedicated operations (not free-form
 * status edits) so renewal chains and move-out dates stay consistent.
 */

/** Terminate an active/pending lease early. */
export const terminateLeaseSchema = z.strictObject({
  moveOutDate: isoDateSchema,
  reason: optionalTextSchema,
});
export type TerminateLeaseInput = z.infer<typeof terminateLeaseSchema>;

/** End a lease at its natural end (records the vacate date). */
export const endLeaseSchema = z.strictObject({
  moveOutDate: isoDateSchema,
});
export type EndLeaseInput = z.infer<typeof endLeaseSchema>;

/**
 * Renew a lease: creates a NEW lease linked to the old one via renewedFromId,
 * carrying the same unit and tenants. History on the old lease is untouched.
 */
export const renewLeaseSchema = z
  .strictObject({
    startDate: isoDateSchema,
    endDate: isoDateSchema.optional(),
    rentCents: positiveCentsSchema,
    depositCents: centsSchema.default(0),
    dueDay: dueDaySchema.default(1),
    graceDays: z.number().int().min(0).max(30).default(0),
    lateFeeCents: centsSchema.default(0),
    notes: optionalTextSchema,
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });
export type RenewLeaseInput = z.infer<typeof renewLeaseSchema>;
