"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  PropertyFormDialog,
  type PropertyForEdit,
} from "@/features/properties/components/property-form-dialog";

type LlcOption = { id: string; name: string };

export function PropertyEditButton({
  property,
  llcs,
}: {
  property: PropertyForEdit;
  llcs: LlcOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Edit
      </Button>
      <PropertyFormDialog
        open={open}
        onOpenChange={setOpen}
        llcs={llcs}
        property={property}
      />
    </>
  );
}
