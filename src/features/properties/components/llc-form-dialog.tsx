"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
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
import { createLlc, updateLlc } from "@/features/properties/server/actions";
import {
  createLlcSchema,
  type CreateLlcInput,
} from "@/features/properties/validation/llc";
import { applyFieldErrors } from "@/lib/forms";
import { useRouter } from "next/navigation";

export type LlcForEdit = {
  id: string;
  name: string;
  legalName?: string | null;
  ein?: string | null;
  notes?: string | null;
};

export function LlcFormDialog({
  open,
  onOpenChange,
  llc,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  llc?: LlcForEdit | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(llc);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateLlcInput>({
    resolver: standardSchemaResolver(createLlcSchema),
    defaultValues: { name: "", legalName: "", ein: "", notes: "" },
  });

  // Refill when the target row changes or the dialog reopens.
  useEffect(() => {
    if (open) {
      reset({
        name: llc?.name ?? "",
        legalName: llc?.legalName ?? "",
        ein: llc?.ein ?? "",
        notes: llc?.notes ?? "",
      });
    }
  }, [open, llc, reset]);

  async function onSubmit(values: CreateLlcInput) {
    const result =
      isEdit && llc ? await updateLlc(llc.id, values) : await createLlc(values);
    if (!result.ok) {
      applyFieldErrors(setError, result.fieldErrors);
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "LLC updated." : "LLC created.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit LLC" : "New LLC"}</DialogTitle>
            <DialogDescription>
              A legal entity that holds title to properties.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <Field
              label="Name"
              htmlFor="llc-name"
              required
              error={errors.name?.message}
            >
              <Input id="llc-name" {...register("name")} />
            </Field>
            <Field
              label="Legal name"
              htmlFor="llc-legal"
              error={errors.legalName?.message}
            >
              <Input id="llc-legal" {...register("legalName")} />
            </Field>
            <Field
              label="EIN"
              htmlFor="llc-ein"
              hint="Format: 12-3456789"
              error={errors.ein?.message}
            >
              <Input id="llc-ein" {...register("ein")} />
            </Field>
            <Field
              label="Notes"
              htmlFor="llc-notes"
              error={errors.notes?.message}
            >
              <Input id="llc-notes" {...register("notes")} />
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
              {isSubmitting
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create LLC"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
