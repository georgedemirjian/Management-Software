import type { UserRole } from "@/types/auth";

/**
 * Wire types shared between API route handlers and their client consumers.
 * Server-side response builders live in src/server/api.ts.
 */

export type ApiErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "INTERNAL_ERROR";

/** Every non-2xx API response has this shape. */
export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

/** GET /api/me */
export type MeResponse = {
  id: string;
  email: string;
  role: UserRole;
};
