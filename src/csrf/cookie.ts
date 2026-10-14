/**
 * Retrieves the value of a cookie by its name.
 *
 * The first matching occurrence is returned, decoded with `decodeURIComponent`
 * (the raw value is returned if decoding fails). Returns `null` outside the browser.
 *
 * @param name - The name of the cookie to retrieve.
 * @returns The cookie value if found; otherwise, `null`.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const encodedPrefix = `${encodeURIComponent(name)}=`
  for (const part of document.cookie.split(';')) {
    const item = part.trim()
    const raw = item.startsWith(prefix)
      ? item.slice(prefix.length)
      : item.startsWith(encodedPrefix)
        ? item.slice(encodedPrefix.length)
        : null
    if (raw === null) continue
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}
