import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { requireOrg, type OrgContext } from "@/server/auth-helpers";

/**
 * Server Action foundation. Every domain mutation is a literal
 * `export async function` (a "use server" module requirement) that delegates
 * to `runOrgAction`, which centralizes the three things every mutation must
 * do: authorize + resolve the active organization, validate input with Zod,
 * and return a typed, serializable result instead of throwing across the
 * client boundary.
 *
 * Reads do NOT use this — Server Components call feature `server/queries.ts`
 * functions directly.
 */

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /** Per-field messages keyed by input field, for form display. */
      fieldErrors?: Record<string, string[] | undefined>;
    };

/**
 * Throw inside a handler to return a clean, user-facing error (e.g. a broken
 * invariant or a not-found). Anything else that throws becomes an opaque
 * "something went wrong" — internals never leak to the client.
 */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export async function runOrgAction<TSchema extends z.ZodType, TData>(
  schema: TSchema,
  input: unknown,
  handler: (args: {
    data: z.output<TSchema>;
    ctx: OrgContext;
  }) => Promise<TData>,
): Promise<ActionResult<TData>> {
  // Authorization first, outside the try: a redirect() from requireOrg must
  // propagate as Next.js control flow, never be caught below.
  const ctx = await requireOrg();

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields and try again.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const data = await handler({ data: parsed.data, ctx });
    return { ok: true, data };
  } catch (error) {
    // Preserve redirect()/notFound() control-flow errors.
    unstable_rethrow(error);
    if (error instanceof ActionError) {
      return { ok: false, error: error.message };
    }
    console.error("[action] unhandled error:", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
