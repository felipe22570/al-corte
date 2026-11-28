/**
 * Joins class names. v2 classes use the `ui:` prefix and its own token names (`ui:text-body`, `ui:text-text-2`), which
 * tailwind-merge would misread, so callers avoid conflicting classes instead of relying on a merge.
 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
