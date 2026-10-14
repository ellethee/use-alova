import type { UseAlovaMethod, UseAlovaOptions } from './types'
import { findHeaderKey } from './headers'
import { pageOrigin, targetOrigin } from './url'

/**
 * Tells whether the token may be sent to the target of a request.
 *
 * The decision is made on the final url, built exactly like alova builds it and resolved like the browser
 * does. Urls with backslashes, control characters or leading whitespace are never trusted.
 * A non-absolute `url` that ends up on the same origin as the configured `baseURL` is trusted (the
 * developer chose that `baseURL`, even on another origin). Otherwise the token is sent only if the target
 * is same-origin with the page or listed in `options.authOrigins`.
 *
 * @param method - The request method.
 * @param options - The options (`baseURL`, `authOrigins`).
 * @returns `true` if the `Authorization` header may be added.
 */
export function isAuthTarget(method: UseAlovaMethod, options: UseAlovaOptions): boolean {
  const baseURL = method.baseURL || options.baseURL || ''
  const url = method.url ?? ''
  const target = targetOrigin(url, baseURL)
  if (target === null) return false
  if (baseURL && !/^https?:\/\//i.test(url) && target === targetOrigin('', baseURL)) return true
  if (target === pageOrigin()) return true
  return Boolean(
    options.authOrigins?.some(o => {
      try {
        return new URL(o).origin === target
      } catch {
        return false
      }
    })
  )
}

/**
 * Handles authentication by injecting a token into the `Authorization` header (`<authType> <token>`,
 * `Bearer` by default; `authType` may be a function of the method, returning `undefined`/`''` for `Bearer`).
 *
 * An `Authorization` header already set on the request is never overwritten; when none is set,
 * the token comes from `options.token` (a string, or a possibly asynchronous function called with the method).
 * `null`/empty `Authorization` values are removed.
 *
 * The token is sent to requests built from a relative `url` (they target the configured `baseURL`),
 * and to absolute-URL requests only when same-origin or listed in `options.authOrigins`:
 * it is never leaked to third-party hosts.
 *
 * @param method - The request method object, whose configuration may be modified.
 * @param options - The options object (`token`, `authType`, `authOrigins`, `baseURL`).
 */
export async function defaultAuthHandler(
  method: UseAlovaMethod,
  options: UseAlovaOptions
): Promise<void> {
  const headers = method.config.headers as Record<string, any>
  const existingKey = findHeaderKey(headers, 'authorization')
  if (existingKey && headers[existingKey]) return
  if (existingKey) delete headers[existingKey]
  if (!isAuthTarget(method, options) || !options.token) return
  const token = typeof options.token === 'function' ? await options.token(method) : options.token
  if (!token) return
  const type = typeof options.authType === 'function' ? options.authType(method) : options.authType
  headers.Authorization = `${type || 'Bearer'} ${token}`
}
