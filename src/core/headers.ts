/**
 * Finds the actual key of a header in a headers object, ignoring case.
 *
 * @param headers - Headers object (may be `undefined`/`null`).
 * @param name - Header name to look for (any case).
 * @returns The key as spelled in `headers`, or `undefined` when not present.
 */
export function findHeaderKey(
  headers: Record<string, any> | undefined | null,
  name: string
): string | undefined {
  const lower = name.toLowerCase()
  return Object.keys(headers ?? {}).find(key => key.toLowerCase() === lower)
}

/**
 * Merges header objects case-insensitively: later sources win, and the winner keeps its own key spelling.
 * Without this, `{ Authorization: 'a' }` and `{ authorization: 'b' }` would both survive and `fetch`
 * would send the combined value `a, b`.
 *
 * @param sources - Header objects, from the lowest to the highest priority (`undefined` entries are skipped).
 * @returns A new header object with at most one key per header name.
 */
export function mergeHeaders(
  ...sources: Array<Record<string, any> | undefined | null>
): Record<string, any> {
  const result: Record<string, any> = {}
  for (const source of sources) {
    if (!source) continue
    for (const key of Object.keys(source)) {
      const previous = findHeaderKey(result, key)
      if (previous !== undefined) delete result[previous]
      result[key] = source[key]
    }
  }
  return result
}
