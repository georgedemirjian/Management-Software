import type { Metadata } from "next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LlcsTable } from "@/features/properties/components/llcs-table";
import { PropertiesTable } from "@/features/properties/components/properties-table";
import { listLlcs, listProperties } from "@/features/properties/server/queries";
import { requireOrg } from "@/server/auth-helpers";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage() {
  const { organizationId } = await requireOrg();
  const [properties, llcs] = await Promise.all([
    listProperties(organizationId),
    listLlcs(organizationId),
  ]);

  const llcOptions = llcs.map((llc) => ({ id: llc.id, name: llc.name }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <p className="text-sm text-muted-foreground">
          Buildings, units, and the LLCs that hold them.
        </p>
      </div>

      <Tabs defaultValue="properties">
        <TabsList>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="llcs">LLCs</TabsTrigger>
        </TabsList>
        <TabsContent value="properties" className="mt-4">
          <PropertiesTable properties={properties} llcs={llcOptions} />
        </TabsContent>
        <TabsContent value="llcs" className="mt-4">
          <LlcsTable llcs={llcs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
