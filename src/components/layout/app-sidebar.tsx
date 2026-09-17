"use client";

import {
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/**
 * Dashboard navigation. Only Dashboard is live in this phase — the rest are
 * placeholders rendered disabled until their domain features ship. Flip
 * `enabled` when a section gets its first page.
 */
const NAV_ITEMS = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    title: "Properties",
    href: "/dashboard/properties",
    icon: Building2,
    enabled: true,
  },
  { title: "Tenants", href: "/dashboard/tenants", icon: Users, enabled: true },
  {
    title: "Leases",
    href: "/dashboard/leases",
    icon: FileText,
    enabled: true,
  },
  {
    title: "Payments",
    href: "/dashboard/payments",
    icon: CreditCard,
    enabled: true,
  },
  {
    title: "Documents",
    href: "/dashboard/documents",
    icon: FileText,
    enabled: true,
  },
  {
    title: "Messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    enabled: false,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    enabled: false,
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold tracking-tight">
          Property Manager
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.enabled ? (
                    <SidebarMenuButton
                      isActive={
                        pathname === item.href ||
                        (item.href !== "/dashboard" &&
                          pathname.startsWith(`${item.href}/`))
                      }
                      render={<Link href={item.href} />}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton
                      disabled
                      aria-disabled
                      className="opacity-50"
                      title="Coming in a later phase"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
