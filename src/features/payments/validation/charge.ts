import { z } from "zod";

import { ChargeType } from "@/generated/prisma/enums";
import {
  idSchema,
  isoDateSchema,
  optionalTextSchema,
  positiveCentsSchema,
} from "@/validation/common";

/**
 * Charges are append-only: there is no delete input, and status changes
 * (WAIVED / VOIDED) are dedicated operations, not free-form updates.
 */
export const createChargeSchema = z
  .strictObject({
    leaseId: idSchema,
    type: z.enum(ChargeType),
    amountCents: positiveCentsSchema,
    description: optionalTextSchema,
    dueDate: isoDateSchema,
    periodStart: isoDateSchema.optional(),
    periodEnd: isoDateSchema.optional(),
  })
  .refine(
    (v) =>
      (v.periodStart === undefined) === (v.periodEnd === undefined) &&
      (!v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart),
    {
      message: "periodStart and periodEnd must be provided together, in order",
      path: ["periodEnd"],
    },
  );

export type CreateChargeInput = z.infer<typeof createChargeSchema>;
