import { z } from "zod";

import { labelSchema, optionalTextSchema } from "@/validation/common";

/**
 * Domain person record only. Linking a Tenant to a login (`userId`) is a
 * separate privileged operation (account provisioning), deliberately NOT
 * part of these inputs.
 */
export const createTenantSchema = z.strictObject({
  firstName: labelSchema,
  lastName: labelSchema,
  email: z.email().optional(),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[+\d][\d\s().-]+$/, "Enter a valid phone number")
    .optional(),
  notes: optionalTextSchema,
});

export const updateTenantSchema = createTenantSchema.partial();

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
