const MAX_SLUG_LENGTH = 60;
const COMBINING_MARKS = /[\u0300-\u036f]/g;

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Builds a human-readable route segment: `{slug}-{id}` (falls back to a bare
 * `id` if the label has no slug-able characters). The id stays the actual
 * lookup key — the slug is cosmetic and never re-validated against it, so
 * renaming the underlying record never breaks a bookmarked/shared URL.
 */
export function toSlugParam(label: string, id: string): string {
  const slug = slugify(label);
  return slug ? `${slug}-${id}` : id;
}

/**
 * Extracts the id from a `{slug}-{id}` route segment. cuids never contain a
 * hyphen, so the trailing segment after the last hyphen is always the id —
 * this also correctly handles a bare id param with no slug prefix at all.
 */
export function idFromSlugParam(param: string): string {
  const index = param.lastIndexOf("-");
  return index === -1 ? param : param.slice(index + 1);
}
