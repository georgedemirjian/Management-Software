@AGENTS.md

# Property Manager

Property management app: one landlord, ~80 tenants, multiple properties across
multiple LLCs. Must be able to evolve into multi-tenant SaaS without a
rewrite. Prioritize clean architecture, maintainability, and type safety over
speed of delivery. Full architecture rationale lives in README.md.

**Current phase: foundation only.** Do not add business features (properties,
tenants, leases, payments) unless explicitly asked.

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

## Multi-tenancy (the one non-negotiable)

Every future domain table carries an `organizationId` (an LLC) from its first
migration, and queries are scoped by it. When organizations are built, use
Better Auth's `organization` plugin (`better-auth/plugins/organization`).
Never create an unscoped domain table "for now".

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
--output prisma/schema.prisma --yes`, then migrate.
- **Zod v4** syntax: `z.url()`, `z.treeifyError()` — not the v3 forms.
- Money is always integer cents; never floats.
- `tsconfig` has `noUncheckedIndexedAccess` (indexing returns
  `T | undefined`) and `verbatimModuleSyntax` (use `import type`).
