import { z } from "zod";

import { labelSchema, optionalTextSchema } from "@/validation/common";

export const createLlcSchema = z.strictObject({
  name: labelSchema,
  legalName: optionalTextSchema,
  // Loose on purpose: formatted or bare EIN, validated properly if tax
  // features ever need it.
  ein: z
    .string()
    .trim()
    .regex(/^\d{2}-?\d{7}$/, "EIN must look like 12-3456789")
    .optional(),
  notes: optionalTextSchema,
});

export const updateLlcSchema = createLlcSchema.partial();

export type CreateLlcInput = z.infer<typeof createLlcSchema>;
export type UpdateLlcInput = z.infer<typeof updateLlcSchema>;
