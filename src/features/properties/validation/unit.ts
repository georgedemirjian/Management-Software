import { z } from "zod";

import { idSchema, labelSchema, optionalTextSchema } from "@/validation/common";

export const createUnitSchema = z.strictObject({
  propertyId: idSchema,
  /** Unique within its property, e.g. "Unit 2B" or "Main". */
  label: labelSchema,
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z
    .number()
    .multipleOf(0.5, "Bathrooms come in halves")
    .min(0)
    .max(9.5)
    .optional(),
  sqft: z.number().int().positive().max(100_000).optional(),
  notes: optionalTextSchema,
});

export const updateUnitSchema = createUnitSchema.partial();

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
