import "server-only";

import { db } from "@/server/db";

/**
 * Org-scoped reads for the documents domain. Called directly from Server
 * Components — never from Client Components.
 */

const notDeleted = { deletedAt: null } as const;

export async function listDocuments(organizationId: string) {
  return db.document.findMany({
    where: { organizationId, ...notDeleted },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      property: { select: { id: true, name: true } },
      unit: { select: { id: true, label: true } },
      lease: { select: { id: true } },
      tenant: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export type DocumentListItem = Awaited<
  ReturnType<typeof listDocuments>
>[number];
