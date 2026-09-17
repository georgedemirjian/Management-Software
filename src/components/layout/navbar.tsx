import Link from "next/link";

import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

/**
 * Global navigation placeholder. Primary navigation (properties, tenants,
 * leases, …) lands here as domain features are built.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Property Manager
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Sign in
          </Button>
        </nav>
      </div>
    </header>
  );
}
