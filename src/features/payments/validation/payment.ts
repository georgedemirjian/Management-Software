import { z } from "zod";

import { PaymentMethod } from "@/generated/prisma/enums";
import {
  idSchema,
  optionalTextSchema,
  positiveCentsSchema,
} from "@/validation/common";

/**
 * Recording a received payment. Allocations settle specific charges; their
 * sum may not exceed the payment amount (unallocated remainder = credit,
 * resolved by later application logic). Stripe-originated payments arrive
 * through webhooks in a later phase, not through this input.
 */
export const createPaymentSchema = z
  .strictObject({
    leaseId: idSchema,
    /** Who paid, when known (co-tenant attribution). */
    tenantId: idSchema.optional(),
    method: z.enum(PaymentMethod),
    amountCents: positiveCentsSchema,
    receivedAt: z.coerce.date(),
    /** Check number, bank reference, … */
    reference: optionalTextSchema,
    memo: optionalTextSchema,
    allocations: z
      .array(
        z.strictObject({
          chargeId: idSchema,
          amountCents: positiveCentsSchema,
        }),
      )
      .max(50)
      .optional(),
  })
  .refine(
    (v) =>
      !v.allocations ||
      v.allocations.reduce((sum, a) => sum + a.amountCents, 0) <= v.amountCents,
    {
      message: "Allocations cannot exceed the payment amount",
      path: ["allocations"],
    },
  );

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
