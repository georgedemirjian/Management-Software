import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { PropertyEditButton } from "@/features/properties/components/property-edit-button";
import { UnitsSection } from "@/features/properties/components/units-section";
import { getProperty, listLlcs } from "@/features/properties/server/queries";
import { idFromSlugParam } from "@/lib/slug";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Property" };

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ propertySlug: string }>;
}) {
  const { propertySlug } = await params;
  const propertyId = idFromSlugParam(propertySlug);
  const { organizationId } = await requireOrg();

  const [property, llcs] = await Promise.all([
    getProperty(organizationId, propertyId),
    listLlcs(organizationId),
  ]);

  if (!property) notFound();

  const occupied = property.units.filter((u) => u.activeLease).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/properties"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Properties
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {property.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {property.addressLine1}
            {property.addressLine2 ? `, ${property.addressLine2}` : ""},{" "}
            {property.city}, {property.state} {property.postalCode}
          </p>
        </div>
        <PropertyEditButton
          llcs={llcs.map((llc) => ({ id: llc.id, name: llc.name }))}
          property={{
            id: property.id,
            llcId: property.llc.id,
            name: property.name,
            addressLine1: property.addressLine1,
            addressLine2: property.addressLine2,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode,
            notes: property.notes,
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">LLC</p>
            <p className="font-medium">{property.llc.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Units</p>
            <p className="font-medium">{property.units.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Occupied</p>
            <p className="font-medium">
              {occupied}/{property.units.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {property.notes ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {property.notes}
          </CardContent>
        </Card>
      ) : null}

      <UnitsSection propertyId={property.id} units={property.units} />
    </div>
  );
}
