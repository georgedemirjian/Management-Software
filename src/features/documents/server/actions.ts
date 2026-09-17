"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/server/db";
import { ActionError, runOrgAction, type ActionResult } from "@/server/action";
import { idSchema } from "@/validation/common";
import { createDocumentSchema } from "@/features/documents/validation/document";
import {
  createPresignedDownloadUrl,
  createPresignedUploadUrl,
  isR2Configured,
} from "@/services/storage";

/**
 * Documents-domain mutations. Upload is two steps so the `Document` row is
 * only ever created after the object actually exists in R2:
 *   1. createUploadUrl — mint a presigned PUT + storage key.
 *   2. finalizeDocument — after the browser's PUT succeeds, insert the row.
 */

const notDeleted = { deletedAt: null } as const;

async function assertParentInOrg(
  organizationId: string,
  parent: Pick<
    z.output<typeof createDocumentSchema>,
    "propertyId" | "unitId" | "leaseId" | "tenantId"
  >,
) {
  if (parent.propertyId) {
    const row = await db.property.findFirst({
      where: { id: parent.propertyId, organizationId, ...notDeleted },
      select: { id: true },
    });
    if (!row) throw new ActionError("That property could not be found.");
  }
  if (parent.unitId) {
    const row = await db.unit.findFirst({
      where: { id: parent.unitId, organizationId, ...notDeleted },
      select: { id: true },
    });
    if (!row) throw new ActionError("That unit could not be found.");
  }
  if (parent.leaseId) {
    const row = await db.lease.findFirst({
      where: { id: parent.leaseId, organizationId, ...notDeleted },
      select: { id: true },
    });
    if (!row) throw new ActionError("That lease could not be found.");
  }
  if (parent.tenantId) {
    const row = await db.tenant.findFirst({
      where: { id: parent.tenantId, organizationId, ...notDeleted },
      select: { id: true },
    });
    if (!row) throw new ActionError("That tenant could not be found.");
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function createUploadUrl(
  input: unknown,
): Promise<ActionResult<{ uploadUrl: string; storageKey: string }>> {
  return runOrgAction(createDocumentSchema, input, async ({ data, ctx }) => {
    if (!isR2Configured()) {
      throw new ActionError("Document storage is not configured.");
    }
    await assertParentInOrg(ctx.organizationId, data);

    const storageKey = `org/${ctx.organizationId}/${randomUUID()}-${sanitizeFilename(data.name)}`;
    const uploadUrl = await createPresignedUploadUrl(storageKey, data.mimeType);
    return { uploadUrl, storageKey };
  });
}

const finalizeDocumentSchema = createDocumentSchema.and(
  z.object({ storageKey: z.string().min(1) }),
);

export async function finalizeDocument(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(finalizeDocumentSchema, input, async ({ data, ctx }) => {
    await assertParentInOrg(ctx.organizationId, data);

    const { storageKey, ...metadata } = data;
    const document = await db.document.create({
      data: {
        ...metadata,
        storageKey,
        organizationId: ctx.organizationId,
        uploadedById: ctx.user.id,
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/documents");
    return document;
  });
}

export async function getDownloadUrl(
  input: unknown,
): Promise<ActionResult<{ url: string }>> {
  return runOrgAction(
    z.strictObject({ documentId: idSchema }),
    input,
    async ({ data, ctx }) => {
      if (!isR2Configured()) {
        throw new ActionError("Document storage is not configured.");
      }
      const document = await db.document.findFirst({
        where: {
          id: data.documentId,
          organizationId: ctx.organizationId,
          ...notDeleted,
        },
        select: { storageKey: true, name: true },
      });
      if (!document) throw new ActionError("That document could not be found.");

      const url = await createPresignedDownloadUrl(
        document.storageKey,
        document.name,
      );
      return { url };
    },
  );
}

export async function deleteDocument(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(
    z.strictObject({ documentId: idSchema }),
    input,
    async ({ data, ctx }) => {
      const document = await db.document.findFirst({
        where: {
          id: data.documentId,
          organizationId: ctx.organizationId,
          ...notDeleted,
        },
        select: { id: true },
      });
      if (!document) throw new ActionError("That document could not be found.");

      await db.document.update({
        where: { id: document.id },
        data: { deletedAt: new Date() },
      });

      revalidatePath("/dashboard/documents");
      return { id: document.id };
    },
  );
}
