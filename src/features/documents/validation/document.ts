import { z } from "zod";

import { idSchema, labelSchema } from "@/validation/common";

const parentKeys = ["propertyId", "unitId", "leaseId", "tenantId"] as const;

/**
 * Document METADATA. The storageKey and upload flow belong to the R2
 * service in a later phase — clients never choose storage keys.
 * At most one parent may be set; none = organization-level document.
 */
export const createDocumentSchema = z
  .strictObject({
    name: labelSchema.pipe(z.string().max(255)),
    mimeType: z
      .string()
      .regex(/^[\w.+-]+\/[\w.+-]+$/, "Invalid MIME type")
      .max(120),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024, "Documents are capped at 50 MB"),
    propertyId: idSchema.optional(),
    unitId: idSchema.optional(),
    leaseId: idSchema.optional(),
    tenantId: idSchema.optional(),
  })
  .refine((v) => parentKeys.filter((k) => v[k] !== undefined).length <= 1, {
    message: "A document may be attached to at most one parent",
  });

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
