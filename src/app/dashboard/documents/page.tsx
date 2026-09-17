import type { Metadata } from "next";

import { DocumentsTable } from "@/features/documents/components/documents-table";
import { listDocuments } from "@/features/documents/server/queries";
import { isR2Configured } from "@/lib/env";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { organizationId } = await requireOrg();
  const documents = await listDocuments(organizationId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Leases, photos, and other files stored in Cloudflare R2.
        </p>
      </div>

      <DocumentsTable documents={documents} storageEnabled={isR2Configured()} />
    </div>
  );
}
