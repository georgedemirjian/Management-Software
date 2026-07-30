import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentSession } from "@/server/auth-helpers";

export const metadata: Metadata = {
  title: "Sign in",
};

/** Only same-app paths may be post-login targets — no open redirects. */
function sanitizeRedirect(target: unknown): string {
  if (
    typeof target === "string" &&
    target.startsWith("/") &&
    !target.startsWith("//")
  ) {
    return target;
  }
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string | string[] }>;
}) {
  // proxy.ts already bounces cookie holders optimistically; this is the
  // authoritative server-side check.
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  const { redirectTo } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <LoginForm redirectTo={sanitizeRedirect(redirectTo)} />
    </main>
  );
}
