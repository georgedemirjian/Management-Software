# features/

Domain modules live here, one folder per business domain:

```
features/
  properties/
    components/   UI specific to this domain
    hooks/        TanStack Query hooks (useProperties, useCreateProperty, …)
    server/       queries.ts / mutations.ts — server-only data access
    validation/   Zod schemas for this domain's inputs
    types.ts      Domain types shared across the module
  tenants/
  leases/
```

Rules:

- A feature may import from `@/components`, `@/lib`, `@/server`, and other
  shared layers — never from another feature's internals. If two features
  need the same code, promote it to a shared layer.
- Route files in `src/app` stay thin: they compose feature components and
  call feature server functions, nothing more.
