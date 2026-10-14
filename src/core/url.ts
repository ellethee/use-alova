/**
 * Returns `true` when the given string is an absolute URL (has a scheme such as `http:`)
 * or a protocol-relative URL (`//host/path`).
 *
 * @param url - The string to check.
 * @returns Whether the URL is absolute.
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url)
}

/**
 * Joins a base URL (absolute or relative) with a url, normalizing exactly one slash between them.
 * An absolute `url` is returned untouched. A missing/empty `url` returns the base as is.
 *
 * @param baseURL - The base URL (e.g. `https://host/api`, `/api`). Optional.
 * @param url - The url (path) to append. Optional.
 * @returns The joined URL.
 *
 * @example
 * joinUrl('/api/', '/users') // '/api/users'
 * joinUrl('https://x.org/api', 'users') // 'https://x.org/api/users'
 * joinUrl('/api', 'http://other.org/a') // 'http://other.org/a'
 */
export function joinUrl(baseURL?: string | null, url?: string | null): string {
  const base = baseURL ?? ''
  const path = url ?? ''
  if (!base) return path
  if (!path) return base
  if (isAbsoluteUrl(path)) return path
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** Stand-in page origin used when there is no usable `location` (SSR, `file:`, tests). */
const FALLBACK_ORIGIN = 'http://use-alova.invalid'

/**
 * Returns the origin of the page, or a stand-in when it cannot be determined.
 *
 * @returns The page origin.
 */
export function pageOrigin(): string {
  const origin = typeof location === 'undefined' ? undefined : location.origin
  return origin && origin !== 'null' ? origin : FALLBACK_ORIGIN
}

/**
 * Tells whether a url (or base URL) contains characters that make its resolution ambiguous:
 * backslashes (browsers read them as `/`), ASCII control characters (tab/newline are stripped by the
 * URL parser, so `/\t/evil.com` becomes `//evil.com`) or leading whitespace.
 *
 * @param u - The string to check.
 * @returns `true` if the string must be treated as untrusted.
 */
export function isUnsafeUrl(u: string): boolean {
  // oxlint-disable-next-line no-control-regex
  return /[\\\u0000-\u001f\u007f]/.test(u) || /^\s/.test(u)
}

/**
 * Builds the final request URL exactly like alova does (`buildCompletedURL`): only `http(s)://` urls are
 * absolute, anything else is appended to the `baseURL` (one slash between them).
 *
 * @param url - The request url.
 * @param baseURL - The base URL.
 * @returns The completed url.
 */
export function completeUrl(url: string, baseURL: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const base = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL
  return base + (url === '' ? '' : url.startsWith('/') ? url : `/${url}`)
}

/**
 * Resolves the final url of a request to an origin, the way the browser will resolve it.
 *
 * @param url - The request url.
 * @param baseURL - The base URL.
 * @returns The origin the request will reach (`'null'` for opaque schemes, which have no host),
 *   or `null` if the url is unsafe or cannot be parsed.
 */
export function targetOrigin(url: string, baseURL: string): string | null {
  if (isUnsafeUrl(url) || isUnsafeUrl(baseURL)) return null
  try {
    return new URL(completeUrl(url, baseURL), pageOrigin()).origin
  } catch {
    return null
  }
}

/**
 * Checks whether a request targets the current origin.
 *
 * The final url is built exactly like alova builds it (`baseURL` + url, only `http(s)://` is absolute)
 * and resolved like the browser does, then compared with `location.origin`. Urls containing backslashes,
 * control characters or leading whitespace are never same-origin. Urls with an opaque scheme (no host,
 * e.g. a `baseURL` such as `localhost:3000/api`) cannot reach another host and count as same-origin.
 *
 * @param url - The request url.
 * @param baseURL - The optional base URL.
 * @returns `true` if the request is same-origin.
 */
export function isSameOrigin(url: string | undefined, baseURL?: string): boolean {
  const target = targetOrigin(url ?? '', baseURL ?? '')
  return target !== null && (target === 'null' || target === pageOrigin())
}
