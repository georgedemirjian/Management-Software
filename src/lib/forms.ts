import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Push a Server Action's `fieldErrors` back onto a React Hook Form instance
 * so server-side validation surfaces next to the offending inputs.
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[] | undefined> | undefined,
): void {
  if (!fieldErrors) return;
  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (message) {
      setError(field as Path<T>, { type: "server", message });
    }
  }
}

/** register() option: "" → undefined, otherwise Number — for optional numeric inputs. */
export const numericField = {
  setValueAs: (value: string): number | undefined =>
    value === "" ? undefined : Number(value),
};
