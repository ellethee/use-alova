import type { UseAlovaBeforeRequest } from '../core/types'
import { findHeaderKey } from '../core/headers'
import { isSameOrigin } from '../core/url'
import { getCookie } from './cookie'

/**
 * Options of {@link csrfHandler}.
 *
 * @property cookieName - Cookie that holds the CSRF token. Default `'csrftoken'`.
 * @property headerName - Header that carries the token. Default `'X-CSRFToken'`.
 */
export interface CsrfOptions {
  cookieName?: string
  headerName?: string
}

/** Methods that carry the CSRF token. */
const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/**
 * Creates a `beforeRequestHandlers` entry that sends the CSRF token (double-submit cookie pattern).
 *
 * For `POST`/`PUT`/`PATCH`/`DELETE` requests to the same origin it reads the token from the cookie and sets it
 * in the header. Cross-origin requests never receive it. Does nothing outside the browser (no `document`).
 *
 * The header name is looked up case-insensitively: a value already present on the request (set by the caller
 * or by `defaultHeaders`, under any spelling) is never overwritten, so exactly one value is sent. An empty or
 * `null` value does not count and is replaced.
 *
 * @param options - Cookie and header names.
 * @returns The handler, to put in `beforeRequestHandlers`.
 *
 * @example
 * ```ts
 * import { csrfHandler } from '@ilpachi/use-alova/csrf'
 *
 * createUseAlova({ baseURL: '/api', beforeRequestHandlers: [csrfHandler()] })
 * ```
 */
export function csrfHandler(options: CsrfOptions = {}): UseAlovaBeforeRequest {
  const cookieName = options.cookieName ?? 'csrftoken'
  const headerName = options.headerName ?? 'X-CSRFToken'
  return (method, useAlovaOptions) => {
    if (typeof document === 'undefined') return
    if (!UNSAFE_METHODS.includes(String(method.type).toUpperCase())) return
    if (!isSameOrigin(method.url, method.baseURL || useAlovaOptions.baseURL)) return
    const token = getCookie(cookieName)
    if (!token) return
    const headers = method.config.headers as Record<string, any>
    const existingKey = findHeaderKey(headers, headerName)
    if (existingKey !== undefined) {
      if (headers[existingKey]) return
      delete headers[existingKey]
    }
    headers[headerName] = token
  }
}
