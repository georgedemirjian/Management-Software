"use server";

import { revalidatePath } from "next/cache";

import {
  createTenantSchema,
  updateTenantSchema,
} from "@/features/tenants/validation/tenant";
import { ActionError, runOrgAction, type ActionResult } from "@/server/action";
import { db } from "@/server/db";

const notDeleted = { deletedAt: null } as const;

export async function createTenant(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(createTenantSchema, input, async ({ data, ctx }) => {
    const tenant = await db.tenant.create({
      data: {
        ...data,
        organizationId: ctx.organizationId,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    revalidatePath("/dashboard/tenants");
    return { id: tenant.id };
  });
}

export async function updateTenant(
  tenantId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(updateTenantSchema, input, async ({ data, ctx }) => {
    const existing = await db.tenant.findFirst({
      where: {
        id: tenantId,
        organizationId: ctx.organizationId,
        ...notDeleted,
      },
      select: { id: true },
    });
    if (!existing) throw new ActionError("That tenant could not be found.");
    await db.tenant.update({ where: { id: tenantId }, data });
    revalidatePath("/dashboard/tenants");
    revalidatePath(`/dashboard/tenants/${tenantId}`);
    return { id: tenantId };
  });
}

export async function deleteTenant(
  tenantId: string,
): Promise<ActionResult<null>> {
  return runOrgAction(updateTenantSchema, {}, async ({ ctx }) => {
    const existing = await db.tenant.findFirst({
      where: {
        id: tenantId,
        organizationId: ctx.organizationId,
        ...notDeleted,
      },
      select: { id: true },
    });
    if (!existing) throw new ActionError("That tenant could not be found.");
    const activeLeases = await db.leaseTenant.count({
      where: {
        tenantId,
        organizationId: ctx.organizationId,
        lease: { status: "ACTIVE" },
      },
    });
    if (activeLeases > 0) {
      throw new ActionError(
        "This tenant has an active lease. End it before archiving them.",
      );
    }
    await db.tenant.update({
      where: { id: tenantId },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/dashboard/tenants");
    return null;
  });
}
