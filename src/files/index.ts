/**
 * Optional file helpers: `$download`, `$jdownload`, `$form`, `$upload` and the response handlers that turn
 * files and HTML pages into `BlobResponse` / `Document`.
 *
 * @example
 * ```ts
 * import { createUseAlova } from '@ilpachi/use-alova'
 * import { fileSuccessHandlers, withFiles } from '@ilpachi/use-alova/files'
 *
 * const useApi = createUseAlova({ baseURL: '/api', successHandlers: fileSuccessHandlers })
 * const { $download, $upload } = withFiles(useApi())
 * ```
 *
 * @module
 */
export { withFiles } from './with-files'
export type { FilesApi } from './with-files'
export { blobHandler, domHandler, fileSuccessHandlers } from './handlers'
export type { BlobResponse } from './blob'
