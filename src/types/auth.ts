/**
 * Application roles, mirrored by the `UserRole` enum in prisma/schema.prisma
 * (Postgres rejects anything else at the column level).
 *
 * These are global *persona* roles — who someone is on the platform.
 * Per-LLC authority will come from Better Auth organization membership in a
 * later phase; do not add LLC-specific roles here.
 */
export const USER_ROLES = ["LANDLORD", "TENANT"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}
