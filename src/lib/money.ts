/**
 * Money helpers. Values are ALWAYS integer cents in storage and transport
 * (see the schema header); these convert only at the display/entry edges.
 */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 145000 → "$1,450.00" (or "$1,450" when whole and `compact`). */
export function formatCents(
  cents: number,
  opts?: { compact?: boolean },
): string {
  const dollars = cents / 100;
  if (opts?.compact && cents % 100 === 0) {
    return usdWhole.format(dollars);
  }
  return usd.format(dollars);
}

/**
 * Parse user-entered dollars ("1,450" / "1450.50" / "$1,450") to integer
 * cents, rounding to the nearest cent. Returns null for non-numeric input.
 */
export function dollarsToCents(input: string | number): number | null {
  const raw =
    typeof input === "number" ? input : Number(input.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(raw)) return null;
  return Math.round(raw * 100);
}

/** Integer cents → plain dollar string for prefilling number inputs. */
export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
