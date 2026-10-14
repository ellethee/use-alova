import type { UseAlovaMethod } from '../core/types'

/**
 * A response taken as a file: the sanitized name and the body, as read by `response.blob()`.
 *
 * @property fileName - File name from `Content-Disposition`, `config.fileName` or `'file.pdf'` (sanitized).
 * @property data - The file content.
 */
export interface BlobResponse {
  fileName: string
  data: Promise<Blob>
}

/**
 * Starts the download of a Blob object by creating a temporary anchor element,
 * setting its href to a URL representing the Blob and simulating a click on it.
 * The file will be downloaded with the name specified in the `blb.fileName` property.
 * The object URL is revoked right after the click.
 *
 * The returned promise rejects if the data cannot be obtained or the download fails:
 * callers that do not await it should attach a `.catch` to avoid an unhandled rejection.
 *
 * @param blb - An object containing a Promise that resolves to a Blob (`data`)
 *              and a string representing the desired file name (`fileName`).
 * @returns A promise that resolves once the download has been triggered.
 */
export async function toBlob(blb: BlobResponse): Promise<void> {
  const value = await blb.data
  if (!value) throw new Error('toBlob: no data to download')
  const url = URL.createObjectURL(value)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = sanitizeFileName(blb.fileName)
    document.body.appendChild(link)
    try {
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      )
    } finally {
      document.body.removeChild(link)
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** Maximum length of a `Content-Disposition` value that is parsed; the rest is ignored. */
const MAX_CONTENT_DISPOSITION_LENGTH = 4096

/** Maximum length of a sanitized file name. */
const MAX_FILE_NAME_LENGTH = 255

/** Default file name of a download when neither `Content-Disposition` nor `fileName` provide one. */
const DEFAULT_DOWNLOAD_FILE_NAME = 'file.pdf'

/**
 * Makes a file name safe to hand to `a.download`: keeps only the last path segment (anything up to the
 * last `/` or `\`), removes control characters and `\ / : * ? " < > |`, and trims dots and spaces
 * (so `..` or `.hidden-dot-only` names cannot escape the download folder).
 *
 * @param name - The raw file name.
 * @param fallback - Returned when nothing is left after sanitizing.
 * @returns The sanitized name, or `fallback`.
 */
export function sanitizeFileName(
  name: string | null | undefined,
  fallback: string = DEFAULT_DOWNLOAD_FILE_NAME
): string {
  const base =
    String(name ?? '')
      .split(/[\\/]/)
      .pop() ?? ''
  const cleaned = base
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '')
    .replace(/^[\s.]+|[\s.]+$/g, '')
  return cleaned.slice(0, MAX_FILE_NAME_LENGTH) || fallback
}

/** One parsed `Content-Disposition` parameter. */
interface DispositionParam {
  name: string
  value: string
}

/**
 * Splits a `Content-Disposition` value into its parameters with a single linear pass (no regular
 * expressions, so crafted headers cannot trigger catastrophic backtracking). Handles quoted strings with
 * backslash escapes, token values and ignores the leading disposition type. Parameter names are matched
 * only at the start of a parameter, so `name="filename=zz"` never yields a `filename` parameter.
 *
 * @param header - The (already length-capped) header value.
 * @returns The parameters, in order, with lower-cased names.
 */
function parseDispositionParams(header: string): DispositionParam[] {
  const params: DispositionParam[] = []
  const n = header.length
  let i = header.indexOf(';')
  while (i >= 0 && i < n) {
    i++ // skip ';'
    while (i < n && (header[i] === ' ' || header[i] === '\t')) i++
    let nameEnd = i
    while (nameEnd < n && header[nameEnd] !== '=' && header[nameEnd] !== ';') nameEnd++
    const name = header.slice(i, nameEnd).trim().toLowerCase()
    if (nameEnd >= n || header[nameEnd] === ';') {
      i = nameEnd
      continue
    }
    i = nameEnd + 1
    while (i < n && (header[i] === ' ' || header[i] === '\t')) i++
    let value = ''
    if (header[i] === '"') {
      i++
      while (i < n && header[i] !== '"') {
        if (header[i] === '\\' && i + 1 < n) i++
        value += header[i++]
      }
      i++ // closing quote
      while (i < n && header[i] !== ';') i++
    } else {
      const start = i
      while (i < n && header[i] !== ';') i++
      value = header.slice(start, i).trim()
    }
    if (name) params.push({ name, value })
  }
  return params
}

/**
 * Decodes an RFC 5987/8187 ext-value (`charset'language'pct-encoded`), supporting UTF-8 and ISO-8859-1
 * (and any other charset `TextDecoder` knows). Unknown charsets or malformed values fall back to the raw text.
 *
 * @param value - The ext-value.
 * @returns The decoded string, or the raw value when it cannot be decoded.
 */
function decodeExtValue(value: string): string {
  const first = value.indexOf("'")
  const second = first < 0 ? -1 : value.indexOf("'", first + 1)
  if (second < 0) return value
  const charset = value.slice(0, first).trim().toLowerCase() || 'utf-8'
  const encoded = value.slice(second + 1)
  try {
    const bytes: number[] = []
    for (let i = 0; i < encoded.length; i++) {
      const c = encoded[i]
      const hex = c === '%' ? encoded.slice(i + 1, i + 3) : ''
      if (/^[0-9a-f]{2}$/i.test(hex)) {
        bytes.push(parseInt(hex, 16))
        i += 2
      } else {
        bytes.push(...new TextEncoder().encode(c))
      }
    }
    return new TextDecoder(charset).decode(new Uint8Array(bytes))
  } catch {
    return encoded
  }
}

/**
 * Extracts the file name from a 'Content-Disposition' header value.
 *
 * The value is scanned linearly (no ReDoS) and only the first 4 KB are considered. `filename*`
 * (RFC 5987 `charset'lang'pct-encoded`, UTF-8 and ISO-8859-1) is preferred over `filename` (quoted with
 * escapes, or a plain token). The result is NOT sanitized: use {@link sanitizeFileName} before saving.
 *
 * @param contentDisposition - The header value.
 * @returns The file name, or `null` if none can be found.
 */
export function parseContentDispositionFileName(contentDisposition: string): string | null {
  const params = parseDispositionParams(contentDisposition.slice(0, MAX_CONTENT_DISPOSITION_LENGTH))
  const extended = params.find(p => p.name === 'filename*' && p.value)
  if (extended) {
    const decoded = decodeExtValue(extended.value.replace(/^"|"$/g, '')).trim()
    if (decoded) return decoded
  }
  const plain = params.find(p => p.name === 'filename')
  return plain?.value || null
}

/** Name of the `meta` flag set by `$download`/`$jdownload` on their requests. */
export const DOWNLOAD_META_KEY = 'useAlovaDownload'

/**
 * Extracts the file name from the 'Content-Disposition' header of a Response object
 * and returns an object containing the file name and the response data as a Blob.
 *
 * The response is taken as a download when it has a 'Content-Disposition' header, when the request was
 * made by `$download`/`$jdownload` (they set `meta.useAlovaDownload`), or when `method.config.fileName`
 * is set explicitly. File name: the one in the header, else `method.config.fileName`, else `'file.pdf'`.
 * The name is always sanitized (see {@link sanitizeFileName}). Any other response (no header, not a download request, no `fileName`) returns `null` so that the
 * other handlers (JSON, DOM) can process it.
 *
 * @param response - The HTTP response object to extract the blob and file name from.
 * @param method - The method configuration object, which may contain a default file name
 *   in `method.config.fileName` (see {@link UseAlovaMethodConfig#fileName}).
 * @returns An object containing the file name and a Promise that resolves to the data Blob,
 *          or `null` if the response is not a download.
 */
export function getBlob(response: Response, method: UseAlovaMethod): BlobResponse | null {
  const contentDisposition = response.headers.get('content-disposition')
  const configured: string | undefined = method.config.fileName
  const isDownload = Boolean(
    (method.meta as Record<string, unknown> | undefined)?.[DOWNLOAD_META_KEY]
  )
  if (contentDisposition) {
    const fallback = sanitizeFileName(configured)
    const fileName = sanitizeFileName(parseContentDispositionFileName(contentDisposition), fallback)
    return { fileName, data: response.blob() }
  }
  if (configured || isDownload)
    return { fileName: sanitizeFileName(configured), data: response.blob() }
  return null
}
