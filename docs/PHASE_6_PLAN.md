# Phase 6 — Documents (Cloudflare R2)

> **Status: planned, not started.** The schema seam already exists
> (`Document` model, `createDocumentSchema` in
> `src/features/documents/validation/document.ts`) and the sidebar nav item
> is stubbed. Nothing else has been built yet.

Goal: let the landlord (and eventually tenants) attach files — leases,
photos, inspection reports, notices — to a property, unit, lease, or tenant,
stored in Cloudflare R2, with the database staying the system of record for
metadata exactly as it already is for money.

## Guiding principle

R2 stores bytes; Postgres stores truth. A `Document` row is only created
**after** the bytes are confirmed in R2 — never before — so there's no path
to a DB row pointing at an object that doesn't exist. The browser uploads
**directly to R2** via a presigned URL; the Next.js server never proxies file
bytes through itself (avoids request-body limits and doubles egress cost for
nothing).

## Architectural decisions to make first

1. **Presigned URLs, not server-proxied uploads.** Two server actions:
   `createUploadUrl` (validates + returns a presigned `PUT` URL and a
   `storageKey`) and `finalizeDocument` (called after the browser's `PUT`
   succeeds; this is what actually inserts the `Document` row). The schema's
   50 MB cap (`document.ts`) is enforced by validating the declared size
   before minting the URL — R2 doesn't itself cap it.
2. **Private bucket, no public URLs.** These are lease PDFs, ID scans,
   inspection photos — treat as PII by default. Downloads go through a
   short-lived (~5 min) presigned `GET` minted by a server action that
   re-checks org (or tenant lease) ownership on every request, mirroring how
   `createLeaseCheckoutSession` re-verifies lease membership. No
   `R2_PUBLIC_URL`/public bucket binding.
3. **R2 is S3-compatible** — use `@aws-sdk/client-s3` +
   `@aws-sdk/s3-request-presigner` against R2's S3 endpoint
   (`https://<account-id>.r2.cloudflarestorage.com`). No Cloudflare-specific
   SDK needed.
4. **Storage key format**: `org/{organizationId}/{cuid}-{sanitizedFilename}`.
   Namespacing by org from day one costs nothing and pre-empts any
   cross-tenant collision once this is multi-tenant SaaS.
5. **Delete is soft, same as everywhere else.** `deleteDocument` sets
   `deletedAt`; the R2 object is left in place (no hard delete call). This
   matches the structural soft-delete convention and avoids a delete-then-
   regret race. Orphan GC (a scheduled sweep of R2 objects whose `Document`
   row was soft-deleted N days ago) is explicitly deferred, not designed now.

## Env vars (mirror the Stripe optional-feature pattern)

Add to `src/lib/env.ts`, all optional, gated by a new `isR2Configured()`
next to `isStripeConfigured()`:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

`isR2Configured()` → `Boolean(env.R2_ACCOUNT_ID && env.R2_BUCKET_NAME)`. The
app must build and run with none of these set — the Documents nav item stays
visible but upload/download surfaces show a "not configured" state, exactly
like the tenant portal's Stripe-disabled note.

## Build order

1. **Service layer** — `src/services/storage/index.ts`: lazy S3 client
   (same `cached ??=` pattern as `getStripe()`), `createPresignedUploadUrl(key,
mimeType, sizeBytes)`, `createPresignedDownloadUrl(key)`. No client-side
   SDK — everything stays server-only.
2. **Queries** — `features/documents/server/queries.ts`: list documents for
   an org, optionally filtered by one parent (`propertyId`/`unitId`/
   `leaseId`/`tenantId`), `deletedAt: null`, `import "server-only"`.
3. **Actions** — `features/documents/server/actions.ts`, all via
   `runOrgAction`:
   - `createUploadUrl(createDocumentSchema)` — re-verify the declared parent
     id belongs to `ctx.organizationId` (same pattern as
     `assertLlcInOrg`), mint the storage key + presigned `PUT`, return
     `{ uploadUrl, storageKey }`. Does **not** touch the DB.
   - `finalizeDocument({ storageKey, ...metadata })` — insert the `Document`
     row now that the object exists. Re-validate the parent id again (it's a
     second round-trip; state may have changed).
   - `getDownloadUrl(documentId)` — re-verify org ownership, mint a
     short-lived presigned `GET`.
   - `deleteDocument(documentId)` — soft delete, `revalidatePath(...)`.
4. **CORS** — configure the R2 bucket's CORS policy to allow `PUT` from the
   app's origin(s) (`http://localhost:3000` in dev, the real domain in
   prod). This is a one-time Cloudflare dashboard/API step, not app code.
5. **Components** — `DocumentUploader` (client component: file picker →
   `createUploadUrl` → `fetch(uploadUrl, { method: "PUT", body: file })` →
   `finalizeDocument` → `router.refresh()`) and `DocumentList` (table with a
   download button that calls `getDownloadUrl` on click and navigates to the
   result). Mount both wherever a property/unit/lease/tenant already has a
   detail page — a "Documents" section or tab, using the existing polymorphic
   parent columns.
6. **Org-level index + nav** — `/dashboard/documents` (all documents,
   filterable by parent type), then enable the already-stubbed sidebar item
   in `app-sidebar.tsx`.

## Testing

- Local: R2 has a free tier, so testing against a real (throwaway) bucket is
  simpler than mocking S3 — matches the "stand up real infra before building"
  lesson from Phase 5's Neon setup.
- Assert the org-boundary re-check: requesting an upload/download URL for a
  parent in another org must fail, same shape of test as the Phase 4
  `assertLlcInOrg` coverage.
- Assert soft-delete: a deleted document disappears from `queries.ts` list
  results but the R2 object and DB row both still physically exist.

## Explicitly deferred

- Tenant-portal visibility (tenants downloading their own lease documents) —
  natural follow-on once this ships, needs the same lease-membership check
  `createLeaseCheckoutSession` already does.
- Virus/malware scanning on upload.
- Thumbnail/preview generation, inline browser preview vs. forced download.
- Versioning (re-uploading a document as a new version vs. a new row).
- Orphan R2 object GC for soft-deleted documents.

## Good companions (separate from core Phase 6, don't block on them)

- **Tenant invitations + email service** — needed regardless of documents;
  a landlord currently has no way to get a tenant their portal login.
- **Late-fee automation** — a cron reading `dueDay`/`graceDays` to issue
  `LATE_FEE` charges automatically. Unrelated to storage, sequenced here
  only because the roadmap grouped them.

## Prerequisite

A real Cloudflare R2 bucket + API token (Cloudflare dashboard → R2 → Manage
API Tokens), same "stand up the real dependency before writing code" rule
Phase 5 used for Neon/Stripe.
