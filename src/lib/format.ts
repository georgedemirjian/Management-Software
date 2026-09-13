/**
 * Display formatting for dates. Civil dates (lease terms, due dates) are
 * stored as @db.Date and come back as a Date at UTC midnight — format them
 * in UTC so "2026-08-01" never displays as July 31 in a western timezone.
 */

const civilDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** A @db.Date value → "Aug 1, 2026" (UTC-stable). */
export function formatCivilDate(value: Date | string): string {
  return civilDate.format(new Date(value));
}

/** A timestamp → localized "Aug 1, 2026, 3:30 PM". */
export function formatDateTime(value: Date | string): string {
  return dateTime.format(new Date(value));
}

/** "2026-08-01" for prefilling <input type="date">. */
export function toDateInputValue(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}
