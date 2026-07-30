import { z } from "zod";

import {
  centsSchema,
  dueDaySchema,
  idSchema,
  isoDateSchema,
  optionalTextSchema,
  positiveCentsSchema,
} from "@/validation/common";

/**
 * Leases are created as DRAFT; lifecycle transitions (activate, renew,
 * terminate, move-out) are dedicated workflows in a later phase, not
 * free-form status edits — that is how renewal chains and moveOutDate stay
 * consistent.
 */
export const createLeaseSchema = z
  .strictObject({
    unitId: idSchema,
    /** 1+ tenants; co-signers welcome. */
    tenantIds: z.array(idSchema).min(1).max(10),
    /** Defaults to the first entry of tenantIds. */
    primaryTenantId: idSchema.optional(),
    startDate: isoDateSchema,
    /** Omit for month-to-month / open-ended. */
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
  })
  .refine(
    (v) => !v.primaryTenantId || v.tenantIds.includes(v.primaryTenantId),
    {
      message: "primaryTenantId must be one of tenantIds",
      path: ["primaryTenantId"],
    },
  );

export type CreateLeaseInput = z.infer<typeof createLeaseSchema>;
