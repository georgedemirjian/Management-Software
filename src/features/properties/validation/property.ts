import { z } from "zod";

import { idSchema, labelSchema, optionalTextSchema } from "@/validation/common";

export const createPropertySchema = z.strictObject({
  llcId: idSchema,
  name: labelSchema,
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: optionalTextSchema,
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(2).max(50),
  postalCode: z.string().trim().min(3).max(12),
  notes: optionalTextSchema,
});

export const updatePropertySchema = createPropertySchema.partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
