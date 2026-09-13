"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Surfaces the outcome of a Stripe Checkout redirect (`?payment=success|
 * canceled`) as a toast, then strips the query param. The payment itself is
 * settled by the webhook, so "success" here just means the tenant finished
 * the hosted flow — the balance updates once the webhook lands.
 */
export function PaymentReturnToast() {
  const params = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);
  const status = params.get("payment");

  useEffect(() => {
    if (!status || shown.current) return;
    shown.current = true;
    if (status === "success") {
      toast.success("Payment submitted — your balance will update shortly.");
    } else if (status === "canceled") {
      toast.info("Checkout canceled.");
    }
    router.replace("/dashboard");
  }, [status, router]);

  return null;
}
