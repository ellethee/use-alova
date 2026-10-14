import type { UseAlovaMethod } from './types'
import { findHeaderKey } from './headers'

/**
 * Checks whether the headers object already contains a `Content-Type` (case-insensitive, non-empty).
 *
 * @param headers - Request headers.
 * @returns `true` if a Content-Type is set.
 */
function hasContentType(headers: Record<string, any> | undefined): boolean {
  const key = findHeaderKey(headers, 'content-type')
  return key !== undefined && Boolean(headers![key])
}

/**
 * Returns the Content-Type that matches a "raw" request body, or `undefined` if the body
 * is not one of the raw types that alova passes to `fetch` without JSON serialization.
 *
 * @param data - Request body.
 * @returns The Content-Type to use, or `undefined`.
 */
export function getRawBodyContentType(data: unknown): string | undefined {
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return 'application/x-www-form-urlencoded;charset=UTF-8'
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.type || 'application/octet-stream'
  }
  if (
    data instanceof ArrayBuffer ||
    (typeof ReadableStream !== 'undefined' && data instanceof ReadableStream)
  ) {
    return 'application/octet-stream'
  }
  return undefined
}

/**
 * Works around alova's fetch adapter forcing `Content-Type: application/json` on raw bodies
 * (`URLSearchParams`, `Blob`, `ArrayBuffer`, `ReadableStream`), which are sent as-is and
 * would otherwise be mislabelled. Sets the matching Content-Type unless one is already set.
 * `FormData` and plain objects/strings are left untouched.
 *
 * @param method - The alova method about to be sent (its headers may be modified).
 */
export function ensureRawBodyContentType(method: UseAlovaMethod): void {
  const contentType = getRawBodyContentType(method.data)
  if (!contentType || hasContentType(method.config.headers)) return
  method.config.headers = { ...method.config.headers, 'Content-Type': contentType }
}
