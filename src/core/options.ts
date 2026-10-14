/**
 * Returns a shallow copy of the object without the properties whose value is `undefined`,
 * so that spreading it over defaults does not override them with `undefined`.
 *
 * @param obj - Source object.
 * @returns A copy without `undefined` values.
 */
export function omitUndefined<T extends object>(obj: T | null | undefined): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(obj ?? {})) {
    if (value !== undefined) (result as Record<string, unknown>)[key] = value
  }
  return result
}

/**
 * Resolves an option that has a default: `undefined` selects the default, `null` (explicit opt-out) selects `whenNull`.
 *
 * @param value - The user value.
 * @param fallback - Used when `value` is `undefined`.
 * @param whenNull - Used when `value` is `null`.
 * @returns The value, the fallback or `whenNull`.
 */
export function withDefault<T, N>(value: T | null | undefined, fallback: T, whenNull: N): T | N {
  return value === undefined ? fallback : (value ?? whenNull)
}
