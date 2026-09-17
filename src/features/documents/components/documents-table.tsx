"use client";

import { Download, FileText, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatDateTime } from "@/lib/format";
import {
  createUploadUrl,
  deleteDocument,
  finalizeDocument,
  getDownloadUrl,
} from "@/features/documents/server/actions";
import type { DocumentListItem } from "@/features/documents/server/queries";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parentLabel(doc: DocumentListItem): string {
  if (doc.property) return doc.property.name;
  if (doc.unit) return doc.unit.label;
  if (doc.lease) return "Lease";
  if (doc.tenant) return `${doc.tenant.firstName} ${doc.tenant.lastName}`;
  return "—";
}

export function DocumentsTable({
  documents,
  storageEnabled,
}: {
  documents: DocumentListItem[];
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<DocumentListItem | null>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    try {
      const uploadResult = await createUploadUrl({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (!uploadResult.ok) {
        toast.error(uploadResult.error);
        return;
      }

      const putResponse = await fetch(uploadResult.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putResponse.ok) {
        toast.error("Upload to storage failed. Please try again.");
        return;
      }

      const finalizeResult = await finalizeDocument({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        storageKey: uploadResult.data.storageKey,
      });
      if (!finalizeResult.ok) {
        toast.error(finalizeResult.error);
        return;
      }

      toast.success("Document uploaded.");
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDownload(doc: DocumentListItem) {
    const result = await getDownloadUrl({ documentId: doc.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />
        <Button
          size="sm"
          disabled={!storageEnabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload /> {uploading ? "Uploading…" : "Upload document"}
        </Button>
      </div>

      {!storageEnabled ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Document storage isn&apos;t configured — set the R2 environment
          variables to enable uploads.
        </p>
      ) : documents.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No documents yet.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Attached to</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="flex items-center gap-2 font-medium">
                  <FileText className="size-4 text-muted-foreground" />
                  {doc.name}
                </TableCell>
                <TableCell>{parentLabel(doc)}</TableCell>
                <TableCell>{formatSize(doc.sizeBytes)}</TableCell>
                <TableCell>{formatDateTime(doc.createdAt)}</TableCell>
                <TableCell className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void handleDownload(doc)}
                  >
                    <Download />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleting(doc)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title="Delete document"
          description={`Remove "${deleting.name}"? This can't be undone from the UI.`}
          successMessage="Document deleted."
          onConfirm={() => deleteDocument({ documentId: deleting.id })}
        />
      ) : null}
    </div>
  );
}
