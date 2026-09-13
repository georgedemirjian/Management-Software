"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Field } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createUnit, updateUnit } from "@/features/properties/server/actions";
import {
  createUnitSchema,
  type CreateUnitInput,
} from "@/features/properties/validation/unit";
import { applyFieldErrors, numericField } from "@/lib/forms";

export type UnitForEdit = {
  id: string;
  label: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  notes?: string | null;
};

export function UnitFormDialog({
  open,
  onOpenChange,
  propertyId,
  unit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unit?: UnitForEdit | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(unit);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUnitInput>({
    resolver: standardSchemaResolver(createUnitSchema),
    defaultValues: { propertyId, label: "" },
  });

  useEffect(() => {
    if (open) {
      reset({
        propertyId,
        label: unit?.label ?? "",
        bedrooms: unit?.bedrooms ?? undefined,
        bathrooms: unit?.bathrooms ?? undefined,
        sqft: unit?.sqft ?? undefined,
        notes: unit?.notes ?? "",
      });
    }
  }, [open, unit, propertyId, reset]);

  async function onSubmit(values: CreateUnitInput) {
    const result =
      isEdit && unit
        ? await updateUnit(unit.id, values)
        : await createUnit(values);
    if (!result.ok) {
      applyFieldErrors(setError, result.fieldErrors);
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Unit updated." : "Unit added.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit unit" : "Add unit"}</DialogTitle>
            <DialogDescription>
              A rentable space within this property. Single-family homes have
              one unit.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <Field
              label="Label"
              htmlFor="unit-label"
              required
              hint='e.g. "Unit 2B" or "Main"'
              error={errors.label?.message}
            >
              <Input id="unit-label" {...register("label")} />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field
                label="Beds"
                htmlFor="unit-beds"
                error={errors.bedrooms?.message}
              >
                <Input
                  id="unit-beds"
                  type="number"
                  min={0}
                  {...register("bedrooms", numericField)}
                />
              </Field>
              <Field
                label="Baths"
                htmlFor="unit-baths"
                error={errors.bathrooms?.message}
              >
                <Input
                  id="unit-baths"
                  type="number"
                  min={0}
                  step={0.5}
                  {...register("bathrooms", numericField)}
                />
              </Field>
              <Field
                label="Sq ft"
                htmlFor="unit-sqft"
                error={errors.sqft?.message}
              >
                <Input
                  id="unit-sqft"
                  type="number"
                  min={0}
                  {...register("sqft", numericField)}
                />
              </Field>
            </div>

            <Field
              label="Notes"
              htmlFor="unit-notes"
              error={errors.notes?.message}
            >
              <Input id="unit-notes" {...register("notes")} />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Add unit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
