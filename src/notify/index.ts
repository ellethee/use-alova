/**
 * Optional, dependency-free notifications: toast, modal box and ready-made `errorMessageFunction`s.
 *
 * @example
 * ```ts
 * import { createUseAlova } from '@ilpachi/use-alova'
 * import { toastMessage } from '@ilpachi/use-alova/notify'
 *
 * export const useApi = createUseAlova({ baseURL: '/api', errorMessageFunction: toastMessage })
 * ```
 *
 * @module
 */
export { Toast, Box, showToast, showBox } from './notify'
export type { NotifyOptions, NotifyIcon, NotifyPosition } from './notify'
export { toastMessage, boxMessage, createToastMessage, createBoxMessage } from './messages'
export type { ErrorMessageFunction } from './messages'
