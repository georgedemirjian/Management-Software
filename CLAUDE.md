@AGENTS.md

# Property Manager

Property management app: one landlord, ~80 tenants, multiple properties across
multiple LLCs. Must be able to evolve into multi-tenant SaaS without a
rewrite. Prioritize clean architecture, maintainability, and type safety over
speed of delivery. Full architecture rationale lives in README.md.

**Current phase: foundation + auth + domain model complete (Phases 1–3).**
The full schema (org → LLC → property → unit → lease → tenants/ledger/docs)
exists with migrations, Zod schemas, and a realistic seed — but there are NO
CRUD pages or business workflows yet; do not add them unless explicitly
asked. There is NO public registration: the first LANDLORD comes from
`npm run db:seed`; future tenant accounts will be provisioned via the Better
Auth admin plugin.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 ·
shadcn/ui on **Base UI** (`base-nova` style) · Prisma 7 + PostgreSQL ·
Better Auth · TanStack Query v5 · React Hook Form · Zod v4.
Planned later: Cloudflare R2 (documents), Stripe (payments).

## Commands

- `npm run check` — typecheck + lint + format check; run before finishing work
- `npm run dev` / `npm run build`
- `npm run db:migrate -- --name <name>` — needs a running Postgres
  (`npm run db:up` for Docker, or `npx prisma dev`)
- `npm run db:generate` — after every schema edit
- `npm run db:seed` — creates the initial LANDLORD from `SEED_LANDLORD_*`
  env vars (idempotent)

## Architecture rules

- `src/app` is thin routing; business logic lives in `src/features/<domain>`
  (layout inside each feature: `components/`, `hooks/`, `server/`,
  `validation/` — see src/features/README.md).
- Import direction: `app → features → server|services → lib`. Features never
  import another feature's internals.
- `src/server/**` is server-only (Prisma, Better Auth); never import it from
  Client Components. Browser auth goes through `src/lib/auth-client.ts`.
- Read config via `import { env } from "@/lib/env"` — never `process.env`
  directly. New env vars: add to the Zod schema in `src/lib/env.ts` AND
  `.env.example`.
- Database access only via `import { db } from "@/server/db"`.
- Validate all external input (forms, route handlers, server actions) with
  Zod schemas.

## Authorization (Phase 2 — use these, never inline auth logic)

- Pages/layouts/Server Actions: `requireAuth()`, `requireRole(role)`,
  `requireLandlord()`, `requireTenant()`, `requireOrg()`,
  `getCurrentUser()`, `getCurrentSession()` from `@/server/auth-helpers`
  (they redirect).
- API route handlers: wrap in `apiHandler(...)` and use `requireApiAuth()` /
  `requireApiRole(role)` / `requireApiOrg()` from `@/server/api` (they throw
  typed 401/403 → standardized JSON from `@/types/api`). `/api/me` is the
  canonical example.
- EVERY domain query filters by the `organizationId` from
  `requireOrg()`/`requireApiOrg()`. Organization ids never come from client
  input — input schemas exclude them by design.
- **Every protected page/action/handler calls a guard itself.** The
  dashboard layout's `requireAuth()` and `src/proxy.ts` (cookie-presence
  check only, not security) are not sufficient alone.
- Roles are the `UserRole` union from `@/types/auth` (LANDLORD | TENANT) —
  persona-level only. Per-LLC authority comes with the `organization`
  plugin in Phase 3; extend `statement` in `src/lib/permissions.ts` for new
  resources instead of ad-hoc role checks.
- Route groups: `(marketing)` public + navbar, `(auth)/login` public,
  `dashboard/` protected shell (sidebar + topbar).

## Multi-tenancy (the one non-negotiable)

The Better Auth organization = the MANAGEMENT BUSINESS (SaaS boundary).
An LLC is a plain domain row under it — NOT an access boundary (this
corrects the Phase 1–2 note that said "LLC = organization"). Every domain
table carries `organizationId` — including derivable children — and a
child's `organizationId` must equal its parent's. Never create an unscoped
domain table. Organization members are STAFF ONLY; tenant users are never
members (they reach their data via `Tenant.userId`).

## Domain model rules (Phase 3)

- Hierarchy: Organization → Llc → Property → Unit → Lease →
  {LeaseTenant→Tenant, Charge, Payment→PaymentAllocation, Document}.
- Money: integer cents in `*Cents` columns; USD assumed. Never floats.
- Civil dates (lease terms, dueDate) are `@db.Date` — construct with
  `new Date(Date.UTC(y, m-1, d))` to avoid TZ drift.
- FINANCIAL ROWS ARE APPEND-ONLY: never delete or mutate amounts on
  Charge/Payment/PaymentAllocation. Corrections = status changes (VOIDED /
  WAIVED / REFUNDED). Restrict FKs enforce this at the DB.
- Structural rows (Llc/Property/Unit/Tenant/Lease/Document) soft-delete via
  `deletedAt` — every read must filter `deletedAt: null`.
- `Charge.status` is derivable from allocations; update it in the SAME
  transaction that writes PaymentAllocation rows.
- Lease lifecycle: DRAFT → PENDING → ACTIVE → ENDED/TERMINATED. Renewals
  create a NEW lease with `renewedFromId`; move-out sets `moveOutDate`.
  Transitions are dedicated workflows, never free-form status edits.
- Tenant ≠ User: Tenant is the person record; `userId` optional link.
- Zod: shared primitives in `@/validation/common`; per-entity
  `z.strictObject` create/update schemas in `features/<domain>/validation/`.
  Inputs never include organizationId/ids/timestamps.

## Gotchas

- **Prisma 7**: client is generated to `src/generated/prisma` (gitignored;
  `postinstall` regenerates). Import types from
  `@/generated/prisma/client`. Runtime needs the `@prisma/adapter-pg` driver
  adapter — already wired in `src/server/db.ts`. CLI config is
  `prisma.config.ts` (loads `.env` via dotenv), not schema-embedded env().
- **shadcn on Base UI**: compose triggers with the `render` prop
  (`<DropdownMenuTrigger render={<Button />}>…`), NOT Radix's `asChild` —
  it does not exist here. Components in `src/components/ui` are owned
  source; edit them directly. Add new ones: `npx shadcn@latest add <name>`.
- **Better Auth schema changes** (e.g. adding plugins): regenerate models
  with `npx @better-auth/cli@latest generate --config src/server/auth.ts
--output prisma/schema.prisma --yes`, then migrate. Review the diff: the
  generator may revert `User.role` to `String?` (keep the `UserRole` enum)
  and may drop the domain back-relations on `Organization`/`User` (restore
  them — they're marked with comments in the schema).
- **activeOrganizationId** is set on session CREATE by a databaseHook in
  `src/server/auth.ts` (first membership wins). Org switching later needs
  Better Auth's `setActive` API + hook revision.
- **Local dev DB**: `npm run db:up` (Docker) or any Postgres at
  DATABASE_URL. Hosted Postgres needs SHADOW_DATABASE_URL for
  `migrate dev`. Avoid `npx prisma dev` — its multi-database emulation
  proved unreliable in testing (Phase 3).
- **Session cookieCache is 5 min**: bans/revocations may take up to 5
  minutes to propagate to issued cookies. Rate limiting persists in the
  `rateLimit` table (works across serverless instances).
- **Zod v4** syntax: `z.url()`, `z.treeifyError()` — not the v3 forms.
- Money is always integer cents; never floats.
- `tsconfig` has `noUncheckedIndexedAccess` (indexing returns
  `T | undefined`) and `verbatimModuleSyntax` (use `import type`).
