"use server";

import { revalidatePath } from "next/cache";

import { createLeaseSchema } from "@/features/leases/validation/lease";
import {
  endLeaseSchema,
  renewLeaseSchema,
  terminateLeaseSchema,
} from "@/features/leases/validation/lease-transitions";
import { ActionError, runOrgAction, type ActionResult } from "@/server/action";
import { db } from "@/server/db";
import type { OrgContext } from "@/server/auth-helpers";

const noInputSchema = createLeaseSchema.partial();

async function loadLease(ctx: OrgContext, leaseId: string) {
  const lease = await db.lease.findFirst({
    where: { id: leaseId, organizationId: ctx.organizationId, deletedAt: null },
    select: {
      id: true,
      status: true,
      unitId: true,
      notes: true,
      renewedTo: { select: { id: true } },
    },
  });
  if (!lease) throw new ActionError("That lease could not be found.");
  return lease;
}

/** Create a lease in DRAFT with its tenant assignments. */
export async function createLease(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(createLeaseSchema, input, async ({ data, ctx }) => {
    const org = ctx.organizationId;

    const unit = await db.unit.findFirst({
      where: { id: data.unitId, organizationId: org, deletedAt: null },
      select: { id: true },
    });
    if (!unit) throw new ActionError("That unit could not be found.");

    const tenantCount = await db.tenant.count({
      where: {
        id: { in: data.tenantIds },
        organizationId: org,
        deletedAt: null,
      },
    });
    if (tenantCount !== new Set(data.tenantIds).size) {
      throw new ActionError("One or more selected tenants could not be found.");
    }

    const primaryId = data.primaryTenantId ?? data.tenantIds[0]!;

    const lease = await db.lease.create({
      data: {
        organizationId: org,
        createdById: ctx.user.id,
        unitId: data.unitId,
        status: "DRAFT",
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        rentCents: data.rentCents,
        depositCents: data.depositCents,
        dueDay: data.dueDay,
        graceDays: data.graceDays,
        lateFeeCents: data.lateFeeCents,
        notes: data.notes ?? null,
        tenants: {
          create: [...new Set(data.tenantIds)].map((tenantId) => ({
            organizationId: org,
            tenantId,
            isPrimary: tenantId === primaryId,
          })),
        },
      },
      select: { id: true },
    });

    revalidatePath("/dashboard/leases");
    return { id: lease.id };
  });
}

/** DRAFT or PENDING → ACTIVE. */
export async function activateLease(
  leaseId: string,
): Promise<ActionResult<null>> {
  return runOrgAction(noInputSchema, {}, async ({ ctx }) => {
    const lease = await loadLease(ctx, leaseId);
    if (lease.status !== "DRAFT" && lease.status !== "PENDING") {
      throw new ActionError("Only draft or pending leases can be activated.");
    }
    await db.lease.update({
      where: { id: leaseId },
      data: { status: "ACTIVE" },
    });
    revalidatePath("/dashboard/leases");
    revalidatePath(`/dashboard/leases/${leaseId}`);
    return null;
  });
}

/** ACTIVE → ENDED (natural end), records the vacate date. */
export async function endLease(
  leaseId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return runOrgAction(endLeaseSchema, input, async ({ data, ctx }) => {
    const lease = await loadLease(ctx, leaseId);
    if (lease.status !== "ACTIVE") {
      throw new ActionError("Only active leases can be ended.");
    }
    await db.lease.update({
      where: { id: leaseId },
      data: { status: "ENDED", moveOutDate: new Date(data.moveOutDate) },
    });
    revalidatePath("/dashboard/leases");
    revalidatePath(`/dashboard/leases/${leaseId}`);
    return null;
  });
}

/** ACTIVE or PENDING → TERMINATED (early end). */
export async function terminateLease(
  leaseId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return runOrgAction(terminateLeaseSchema, input, async ({ data, ctx }) => {
    const lease = await loadLease(ctx, leaseId);
    if (lease.status !== "ACTIVE" && lease.status !== "PENDING") {
      throw new ActionError("Only active or pending leases can be terminated.");
    }
    const note = data.reason
      ? `${lease.notes ? `${lease.notes}\n` : ""}Terminated: ${data.reason}`
      : lease.notes;
    await db.lease.update({
      where: { id: leaseId },
      data: {
        status: "TERMINATED",
        moveOutDate: new Date(data.moveOutDate),
        notes: note,
      },
    });
    revalidatePath("/dashboard/leases");
    revalidatePath(`/dashboard/leases/${leaseId}`);
    return null;
  });
}

/**
 * Renew a lease: creates a NEW PENDING lease on the same unit with the same
 * tenants, linked via renewedFromId. The prior lease is marked ENDED (its
 * term concludes into the renewal). History is preserved as two rows.
 */
export async function renewLease(
  leaseId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(renewLeaseSchema, input, async ({ data, ctx }) => {
    const org = ctx.organizationId;
    const prior = await db.lease.findFirst({
      where: { id: leaseId, organizationId: org, deletedAt: null },
      select: {
        id: true,
        status: true,
        unitId: true,
        renewedTo: { select: { id: true } },
        tenants: { select: { tenantId: true, isPrimary: true } },
      },
    });
    if (!prior) throw new ActionError("That lease could not be found.");
    if (prior.renewedTo) {
      throw new ActionError("This lease has already been renewed.");
    }
    if (prior.status !== "ACTIVE" && prior.status !== "ENDED") {
      throw new ActionError("Only active or ended leases can be renewed.");
    }

    const newId = await db.$transaction(async (tx) => {
      const created = await tx.lease.create({
        data: {
          organizationId: org,
          createdById: ctx.user.id,
          unitId: prior.unitId,
          status: "PENDING",
          renewedFromId: prior.id,
          startDate: new Date(data.startDate),
          endDate: data.endDate ? new Date(data.endDate) : null,
          rentCents: data.rentCents,
          depositCents: data.depositCents,
          dueDay: data.dueDay,
          graceDays: data.graceDays,
          lateFeeCents: data.lateFeeCents,
          notes: data.notes ?? null,
          tenants: {
            create: prior.tenants.map((t) => ({
              organizationId: org,
              tenantId: t.tenantId,
              isPrimary: t.isPrimary,
            })),
          },
        },
        select: { id: true },
      });
      if (prior.status === "ACTIVE") {
        await tx.lease.update({
          where: { id: prior.id },
          data: { status: "ENDED" },
        });
      }
      return created.id;
    });

    revalidatePath("/dashboard/leases");
    revalidatePath(`/dashboard/leases/${leaseId}`);
    return { id: newId };
  });
}

/** Soft-delete a DRAFT lease (historical leases are never deleted). */
export async function deleteLease(
  leaseId: string,
): Promise<ActionResult<null>> {
  return runOrgAction(noInputSchema, {}, async ({ ctx }) => {
    const lease = await loadLease(ctx, leaseId);
    if (lease.status !== "DRAFT") {
      throw new ActionError("Only draft leases can be deleted.");
    }
    await db.lease.update({
      where: { id: leaseId },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/dashboard/leases");
    return null;
  });
}
