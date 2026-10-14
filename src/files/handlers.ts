import { defaultJsonHandler } from '../core/handlers'
import { STOP_PROCESSOR } from '../core/pipeline'
import type { UseAlovaResponseProcessor, UseAlovaResponseProcessorOptions } from '../core/types'
import { getBlob } from './blob'
import type { BlobResponse } from './blob'
import { getDom } from './dom'

/**
 * Success handler that takes a response as a file when it has a `Content-Disposition` header, when the
 * request config has `fileName`, or when the request is a `$download`/`$jdownload`.
 *
 * The body is consumed and `[BlobResponse, STOP_PROCESSOR]` is returned, so the pipeline stops and no later
 * handler reads it. Otherwise it returns `undefined` (the pipeline continues).
 *
 * @param options - The processor arguments (`response`, `method`).
 * @returns `[BlobResponse, STOP_PROCESSOR]` for files, `null` without a response, `undefined` otherwise.
 */
export async function blobHandler({
  response,
  method,
}: UseAlovaResponseProcessorOptions): Promise<
  [BlobResponse, typeof STOP_PROCESSOR] | null | undefined
> {
  if (!response) return null
  const blob = getBlob(response, method)
  return blob ? [blob, STOP_PROCESSOR] : undefined
}

/**
 * Success handler that parses HTML responses (`text/html`) into a `Document` (when `DOMParser` exists).
 *
 * The body is consumed and `[Document, STOP_PROCESSOR]` is returned; otherwise `undefined` (the pipeline continues).
 *
 * @param options - The processor arguments (`response`).
 * @returns `[Document, STOP_PROCESSOR]` for HTML, `null` without a response, `undefined` otherwise.
 */
export async function domHandler({
  response,
}: UseAlovaResponseProcessorOptions): Promise<
  [Document, typeof STOP_PROCESSOR] | null | undefined
> {
  if (!response) return null
  const doc = await getDom(response)
  return doc ? [doc, STOP_PROCESSOR] : undefined
}

/**
 * Ready-made `successHandlers`: files, then HTML documents, then the default JSON/text parsing (the
 * behavior of `@ilpachi/use-alova` 1.x). Frozen: spread it to add entries.
 */
export const fileSuccessHandlers: readonly UseAlovaResponseProcessor[] = Object.freeze([
  blobHandler,
  domHandler,
  defaultJsonHandler,
])
