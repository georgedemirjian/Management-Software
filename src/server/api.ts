import { unstable_rethrow } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";

import {
  getCurrentSession,
  toSessionUser,
  type AuthContext,
  type OrgContext,
} from "@/server/auth-helpers";
import type { ApiErrorBody, ApiErrorCode } from "@/types/api";
import type { UserRole } from "@/types/auth";

/**
 * Standardized error handling for API route handlers.
 *
 * Handlers are wrapped in `apiHandler`, which turns thrown `ApiError`s into
 * the shared JSON error shape (src/types/api.ts) and anything unexpected
 * into an opaque 500 — stack traces and internals never reach the client.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static unauthorized(message = "Authentication required.") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }

  static forbidden(
    message = "You do not have permission to perform this action.",
  ) {
    return new ApiError(403, "FORBIDDEN", message);
  }

  static internal(message = "Something went wrong.") {
    return new ApiError(500, "INTERNAL_ERROR", message);
  }

  toResponse(): NextResponse<ApiErrorBody> {
    return NextResponse.json(
      { error: { code: this.code, message: this.message } },
      { status: this.status },
    );
  }
}

type RouteHandler<TContext> = (
  request: NextRequest,
  context: TContext,
) => Promise<Response> | Response;

/** Wraps a route handler with the standardized error boundary. */
export function apiHandler<TContext = unknown>(
  handler: RouteHandler<TContext>,
): RouteHandler<TContext> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Never swallow Next.js control flow (redirect(), notFound(), …).
      unstable_rethrow(error);
      if (error instanceof ApiError) {
        return error.toResponse();
      }
      console.error(
        `[api] ${request.method} ${request.nextUrl.pathname} failed:`,
        error,
      );
      return ApiError.internal().toResponse();
    }
  };
}

/** Session or 401. The API counterpart of requireAuth(). */
export async function requireApiAuth(): Promise<AuthContext> {
  const session = await getCurrentSession();
  if (!session) {
    throw ApiError.unauthorized();
  }
  return { session: session.session, user: toSessionUser(session.user) };
}

/** Session with the given role, 401 if signed out, 403 otherwise. */
export async function requireApiRole(role: UserRole): Promise<AuthContext> {
  const context = await requireApiAuth();
  if (context.user.role !== role) {
    throw ApiError.forbidden();
  }
  return context;
}

/** Session plus active organization id; 403 when no organization is active. */
export async function requireApiOrg(): Promise<OrgContext> {
  const context = await requireApiAuth();
  const organizationId = context.session.activeOrganizationId ?? null;
  if (!organizationId) {
    throw ApiError.forbidden("No active organization.");
  }
  return { ...context, organizationId };
}
