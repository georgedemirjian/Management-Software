"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/server/db";
import { ActionError, runOrgAction, type ActionResult } from "@/server/action";
import {
  createLlcSchema,
  updateLlcSchema,
} from "@/features/properties/validation/llc";
import {
  createPropertySchema,
  updatePropertySchema,
} from "@/features/properties/validation/property";
import {
  createUnitSchema,
  updateUnitSchema,
} from "@/features/properties/validation/unit";

/**
 * Properties-domain mutations (Server Actions). Each is a literal
 * `export async function` per the "use server" contract, delegating to
 * `runOrgAction` for auth + validation + typed results.
 *
 * Ownership rule: any client-supplied id (llcId, propertyId, a row's own id)
 * is re-checked against the caller's organization here — inputs are never
 * trusted to already be in-scope.
 */

const notDeleted = { deletedAt: null } as const;

async function assertLlcInOrg(organizationId: string, llcId: string) {
  const llc = await db.llc.findFirst({
    where: { id: llcId, organizationId, ...notDeleted },
    select: { id: true },
  });
  if (!llc) throw new ActionError("That LLC could not be found.");
}

async function assertPropertyInOrg(organizationId: string, propertyId: string) {
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId, ...notDeleted },
    select: { id: true },
  });
  if (!property) throw new ActionError("That property could not be found.");
}

// ── LLCs ────────────────────────────────────────────────────────────────

export async function createLlc(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(createLlcSchema, input, async ({ data, ctx }) => {
    const llc = await db.llc.create({
      data: {
        ...data,
        organizationId: ctx.organizationId,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    revalidatePath("/dashboard/properties");
    return { id: llc.id };
  });
}

export async function updateLlc(
  llcId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(updateLlcSchema, input, async ({ data, ctx }) => {
    await assertLlcInOrg(ctx.organizationId, llcId);
    await db.llc.update({ where: { id: llcId }, data });
    revalidatePath("/dashboard/properties");
    return { id: llcId };
  });
}

export async function deleteLlc(llcId: string): Promise<ActionResult<null>> {
  // No input body; validate with a permissive schema so requireOrg still runs.
  return runOrgAction(createLlcSchema.partial(), {}, async ({ ctx }) => {
    await assertLlcInOrg(ctx.organizationId, llcId);
    const propertyCount = await db.property.count({
      where: { llcId, organizationId: ctx.organizationId, ...notDeleted },
    });
    if (propertyCount > 0) {
      throw new ActionError(
        "Move or remove this LLC's properties before deleting it.",
      );
    }
    await db.llc.update({
      where: { id: llcId },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/dashboard/properties");
    return null;
  });
}

// ── Properties ────────────────────────────────────────────────────────────

export async function createProperty(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(createPropertySchema, input, async ({ data, ctx }) => {
    await assertLlcInOrg(ctx.organizationId, data.llcId);
    const property = await db.property.create({
      data: {
        ...data,
        organizationId: ctx.organizationId,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    revalidatePath("/dashboard/properties");
    return { id: property.id };
  });
}

export async function updateProperty(
  propertyId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(updatePropertySchema, input, async ({ data, ctx }) => {
    await assertPropertyInOrg(ctx.organizationId, propertyId);
    if (data.llcId) await assertLlcInOrg(ctx.organizationId, data.llcId);
    await db.property.update({ where: { id: propertyId }, data });
    revalidatePath("/dashboard/properties");
    revalidatePath(`/dashboard/properties/${propertyId}`);
    return { id: propertyId };
  });
}

export async function deleteProperty(
  propertyId: string,
): Promise<ActionResult<null>> {
  return runOrgAction(updatePropertySchema, {}, async ({ ctx }) => {
    await assertPropertyInOrg(ctx.organizationId, propertyId);
    const activeLeases = await db.lease.count({
      where: {
        organizationId: ctx.organizationId,
        status: "ACTIVE",
        unit: { propertyId },
      },
    });
    if (activeLeases > 0) {
      throw new ActionError(
        "This property has active leases. End them before deleting it.",
      );
    }
    // Soft-delete the property and its units together.
    await db.$transaction([
      db.unit.updateMany({
        where: { propertyId, ...notDeleted },
        data: { deletedAt: new Date() },
      }),
      db.property.update({
        where: { id: propertyId },
        data: { deletedAt: new Date() },
      }),
    ]);
    revalidatePath("/dashboard/properties");
    return null;
  });
}

// ── Units ───────────────────────────────────────────────────────────────

export async function createUnit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(createUnitSchema, input, async ({ data, ctx }) => {
    await assertPropertyInOrg(ctx.organizationId, data.propertyId);
    const unit = await db.unit.create({
      data: {
        ...data,
        organizationId: ctx.organizationId,
        createdById: ctx.user.id,
      },
      select: { id: true, propertyId: true },
    });
    revalidatePath(`/dashboard/properties/${unit.propertyId}`);
    return { id: unit.id };
  });
}

export async function updateUnit(
  unitId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runOrgAction(updateUnitSchema, input, async ({ data, ctx }) => {
    const unit = await db.unit.findFirst({
      where: { id: unitId, organizationId: ctx.organizationId, ...notDeleted },
      select: { id: true, propertyId: true },
    });
    if (!unit) throw new ActionError("That unit could not be found.");
    // Units cannot be reparented through this action; reject a mismatch
    // rather than silently moving the unit across properties.
    const { propertyId, ...rest } = data;
    if (propertyId !== undefined && propertyId !== unit.propertyId) {
      throw new ActionError("A unit cannot be moved to another property.");
    }
    await db.unit.update({ where: { id: unitId }, data: rest });
    revalidatePath(`/dashboard/properties/${unit.propertyId}`);
    return { id: unitId };
  });
}

export async function deleteUnit(unitId: string): Promise<ActionResult<null>> {
  return runOrgAction(updateUnitSchema, {}, async ({ ctx }) => {
    const unit = await db.unit.findFirst({
      where: { id: unitId, organizationId: ctx.organizationId, ...notDeleted },
      select: { id: true, propertyId: true },
    });
    if (!unit) throw new ActionError("That unit could not be found.");
    const activeLeases = await db.lease.count({
      where: { organizationId: ctx.organizationId, unitId, status: "ACTIVE" },
    });
    if (activeLeases > 0) {
      throw new ActionError(
        "This unit has an active lease. End it before deleting the unit.",
      );
    }
    await db.unit.update({
      where: { id: unitId },
      data: { deletedAt: new Date() },
    });
    revalidatePath(`/dashboard/properties/${unit.propertyId}`);
    return null;
  });
}
