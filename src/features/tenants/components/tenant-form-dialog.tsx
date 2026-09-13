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
import { createTenant, updateTenant } from "@/features/tenants/server/actions";
import {
  createTenantSchema,
  type CreateTenantInput,
} from "@/features/tenants/validation/tenant";
import { applyFieldErrors } from "@/lib/forms";

export type TenantForEdit = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export function TenantFormDialog({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: TenantForEdit | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(tenant);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateTenantInput>({
    resolver: standardSchemaResolver(createTenantSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        firstName: tenant?.firstName ?? "",
        lastName: tenant?.lastName ?? "",
        email: tenant?.email ?? "",
        phone: tenant?.phone ?? "",
        notes: tenant?.notes ?? "",
      });
    }
  }, [open, tenant, reset]);

  async function onSubmit(values: CreateTenantInput) {
    const result =
      isEdit && tenant
        ? await updateTenant(tenant.id, values)
        : await createTenant(values);
    if (!result.ok) {
      applyFieldErrors(setError, result.fieldErrors);
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Tenant updated." : "Tenant created.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit tenant" : "New tenant"}</DialogTitle>
            <DialogDescription>
              A person who rents from you. Portal login is provisioned
              separately.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="First name"
                htmlFor="t-first"
                required
                error={errors.firstName?.message}
              >
                <Input id="t-first" {...register("firstName")} />
              </Field>
              <Field
                label="Last name"
                htmlFor="t-last"
                required
                error={errors.lastName?.message}
              >
                <Input id="t-last" {...register("lastName")} />
              </Field>
            </div>
            <Field
              label="Email"
              htmlFor="t-email"
              error={errors.email?.message}
            >
              <Input id="t-email" type="email" {...register("email")} />
            </Field>
            <Field
              label="Phone"
              htmlFor="t-phone"
              error={errors.phone?.message}
            >
              <Input id="t-phone" {...register("phone")} />
            </Field>
            <Field
              label="Notes"
              htmlFor="t-notes"
              error={errors.notes?.message}
            >
              <Input id="t-notes" {...register("notes")} />
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
                  : "Create tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
