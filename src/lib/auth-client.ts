import { createAuthClient } from "better-auth/react";

/**
 * Better Auth browser client. Import from Client Components only; server
 * code should use `auth.api` from src/server/auth.ts instead.
 *
 * baseURL is omitted because the auth API is served same-origin.
 */
export const authClient = createAuthClient();
