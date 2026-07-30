import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAuth } from "@/server/auth-helpers";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { user } = await requireAuth();

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {user.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome back, {user.name}</CardTitle>
          <CardDescription>
            Authentication is fully wired. Domain features — properties,
            tenants, leases, payments — arrive in the next phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Role</span>
          <Badge variant="secondary">{user.role}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
