import type { AlovaMethodCreateConfig, Method, RequestBody, RespondedAlovaGenerics } from 'alova'
import type { UseAlovaGenerics, UseAlovaReturn } from '../core/types'
import { DOWNLOAD_META_KEY, toBlob } from './blob'
import type { BlobResponse } from './blob'
import { formDataToUrlSearchParams, toFormData, toUrlSearchParams } from './form'

/** Request config accepted by the file helpers. */
type Config<R, T> = AlovaMethodCreateConfig<UseAlovaGenerics, R, T>

/** The helpers added by {@link withFiles}. */
export interface FilesApi {
  /**
   * GET that sends immediately, saves the file (browser only) and resolves to the `BlobResponse`
   * (`null` if an error handler swallowed the error).
   */
  $download<R = unknown, T = unknown>(
    url: string,
    config?: Config<R, T>
  ): Promise<BlobResponse | null>
  /** Same as `$download`, but with POST and an optional body. */
  $jdownload<R = unknown, T = unknown>(
    url: string,
    data?: RequestBody,
    config?: Config<R, T>
  ): Promise<BlobResponse | null>
  /** POST `application/x-www-form-urlencoded` (lazy, like `$post`). */
  $form<R = unknown, T = unknown>(
    url: string,
    data?: RequestBody,
    config?: Config<R, T>
  ): Method<RespondedAlovaGenerics<UseAlovaGenerics, R, T>>
  /** POST multipart with one or more files (lazy, like `$post`). */
  $upload<R = unknown, T = unknown>(
    url: string,
    files: File | Blob | Array<File | Blob>,
    data?: RequestBody,
    config?: Config<R, T>
  ): Method<RespondedAlovaGenerics<UseAlovaGenerics, R, T>>
}

/**
 * Sends a download method and saves the resulting file.
 *
 * @param method - The (not yet sent) download method.
 * @returns The saved `BlobResponse`, or `null` when an error handler swallowed the error.
 * @throws TypeError when the response was not taken as a file (`blobHandler` is missing from `successHandlers`).
 */
async function sendDownload(method: Method): Promise<BlobResponse | null> {
  const result = (await method.send()) as unknown
  if (result === null || result === undefined) return null
  if (typeof result === 'object' && 'fileName' in result && 'data' in result) {
    await toBlob(result as BlobResponse)
    return result as BlobResponse
  }
  throw new TypeError(
    '$download: the response was not handled as a file; add blobHandler to successHandlers (or use fileSuccessHandlers)'
  )
}

/**
 * Adds the file helpers `$download`, `$jdownload`, `$form` and `$upload` to the result of `useAlova()`.
 *
 * `$download` and `$jdownload` need `blobHandler` in the `successHandlers` of the instance (use
 * `successHandlers: fileSuccessHandlers`).
 *
 * @param api - The result of `useAlova()` / `useApi()`.
 * @returns A new object with everything in `api` plus the file helpers (all bound, safe to destructure).
 *
 * @example
 * ```ts
 * const useApi = createUseAlova({ baseURL: '/api', successHandlers: fileSuccessHandlers })
 * const { $get, $download, $upload } = withFiles(useApi({ url: '/files' }))
 * await $download('/report', { fileName: 'report.pdf' })
 * ```
 */
export function withFiles<T extends UseAlovaReturn>(api: T): T & FilesApi {
  const { alova } = api
  const download = <R, TR>(
    type: 'Get' | 'Post',
    url: string,
    data: RequestBody | undefined,
    config: Config<R, TR> | undefined
  ): Promise<BlobResponse | null> => {
    const meta = { ...config?.meta, [DOWNLOAD_META_KEY]: true }
    const method =
      type === 'Get'
        ? alova.Get<R, TR>(url, { ...config, meta })
        : alova.Post<R, TR>(url, data ?? {}, { ...config, meta })
    return sendDownload(method as unknown as Method)
  }
  const helpers: FilesApi = {
    $download: (url, config) => download('Get', url, undefined, config),
    $jdownload: (url, data, config) => download('Post', url, data, config),
    $form: (url, data = {}, config) => {
      const params =
        typeof data === 'string' || data instanceof URLSearchParams
          ? new URLSearchParams(data)
          : typeof FormData !== 'undefined' && data instanceof FormData
            ? formDataToUrlSearchParams(data)
            : toUrlSearchParams(data as Record<string, unknown>)
      return alova.Post(url, params, {
        ...config,
        headers: { ...config?.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
      }) as any
    },
    $upload: (url, files, data = {}, config) => {
      // No Content-Type set manually: the browser generates the multipart/form-data boundary.
      return alova.Post(
        url,
        toFormData(files, data as Record<string, unknown>, config?.fieldName),
        { ...config }
      ) as any
    },
  }
  return { ...api, ...helpers }
}
