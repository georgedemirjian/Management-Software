import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Better Auth access control: the resource → action statements that role
 * permissions are defined against. Shared by server config and (later) the
 * auth client, so it lives in lib and must stay free of server imports.
 *
 * Later phases extend `statement` with domain resources, e.g.
 *   property: ["create", "read", "update", "delete"]
 * and grant them per role below.
 */
export const statement = {
  // user/session administration actions from the admin plugin.
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

/** Full administrative capability: manage users, sessions, bans. */
export const landlordRole = ac.newRole({
  ...adminAc.statements,
});

/** No administrative permissions. */
export const tenantRole = ac.newRole({});

/** Role name → permission set, as consumed by the admin plugin. */
export const rolePermissions = {
  LANDLORD: landlordRole,
  TENANT: tenantRole,
};
