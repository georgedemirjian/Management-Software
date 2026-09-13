"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProperty,
  updateProperty,
} from "@/features/properties/server/actions";
import {
  createPropertySchema,
  type CreatePropertyInput,
} from "@/features/properties/validation/property";
import { applyFieldErrors } from "@/lib/forms";

export type PropertyForEdit = {
  id: string;
  llcId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  notes?: string | null;
};

type LlcOption = { id: string; name: string };

const EMPTY: CreatePropertyInput = {
  llcId: "",
  name: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  notes: "",
};

export function PropertyFormDialog({
  open,
  onOpenChange,
  llcs,
  property,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  llcs: LlcOption[];
  property?: PropertyForEdit | null;
}) {
  const router = useRouter();
  const isEdit = Boolean(property);
  const llcItems = Object.fromEntries(llcs.map((l) => [l.id, l.name]));

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreatePropertyInput>({
    resolver: standardSchemaResolver(createPropertySchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (open) {
      reset(
        property
          ? {
              llcId: property.llcId,
              name: property.name,
              addressLine1: property.addressLine1,
              addressLine2: property.addressLine2 ?? "",
              city: property.city,
              state: property.state,
              postalCode: property.postalCode,
              notes: property.notes ?? "",
            }
          : EMPTY,
      );
    }
  }, [open, property, reset]);

  async function onSubmit(values: CreatePropertyInput) {
    const result =
      isEdit && property
        ? await updateProperty(property.id, values)
        : await createProperty(values);
    if (!result.ok) {
      applyFieldErrors(setError, result.fieldErrors);
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? "Property updated." : "Property created.");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit property" : "New property"}
            </DialogTitle>
            <DialogDescription>
              A building or address held by one of your LLCs.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <Field label="LLC" required error={errors.llcId?.message}>
              <Controller
                control={control}
                name="llcId"
                render={({ field }) => (
                  <Select
                    items={llcItems}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an LLC" />
                    </SelectTrigger>
                    <SelectContent>
                      {llcs.map((llc) => (
                        <SelectItem key={llc.id} value={llc.id}>
                          {llc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field
              label="Property name"
              htmlFor="prop-name"
              required
              error={errors.name?.message}
            >
              <Input id="prop-name" {...register("name")} />
            </Field>

            <Field
              label="Address"
              htmlFor="prop-addr1"
              required
              error={errors.addressLine1?.message}
            >
              <Input id="prop-addr1" {...register("addressLine1")} />
            </Field>
            <Field
              label="Address line 2"
              htmlFor="prop-addr2"
              error={errors.addressLine2?.message}
            >
              <Input id="prop-addr2" {...register("addressLine2")} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label="City"
                htmlFor="prop-city"
                required
                error={errors.city?.message}
              >
                <Input id="prop-city" {...register("city")} />
              </Field>
              <Field
                label="State"
                htmlFor="prop-state"
                required
                error={errors.state?.message}
              >
                <Input id="prop-state" {...register("state")} />
              </Field>
            </div>
            <Field
              label="Postal code"
              htmlFor="prop-zip"
              required
              error={errors.postalCode?.message}
            >
              <Input id="prop-zip" {...register("postalCode")} />
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
                  : "Create property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
