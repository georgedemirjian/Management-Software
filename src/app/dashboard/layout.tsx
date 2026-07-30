import type { ReactNode } from "react";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireAuth } from "@/server/auth-helpers";

/**
 * Authenticated app shell. The requireAuth() here covers the shell, but it
 * is NOT sufficient on its own — layouts don't re-run on client-side
 * navigation between sibling pages, so every dashboard page/action calls
 * requireAuth()/requireRole() itself as well.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { user } = await requireAuth();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">Property Manager</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
