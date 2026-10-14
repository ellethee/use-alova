import type { ResponseError } from '../core/response-error'
import { showBox, showToast } from './notify'
import type { NotifyOptions } from './notify'

/** Function that shows a `ResponseError`: the type of the `errorMessageFunction` option. */
export type ErrorMessageFunction = (err: ResponseError) => Promise<void>

/**
 * Creates an `errorMessageFunction` that shows the error in a toast.
 *
 * The text is `Error: <status> <message>` (`Error: <message>` without a response), where the message comes from
 * `err.getDisplayMessage()`: a plain-text body of up to 200 characters, else the status text. HTML bodies are
 * never shown. `options` customizes the toast (`icon`, `timer`, `position`, `title`); its `text` is always replaced.
 *
 * @param options - Toast options.
 * @returns The message function.
 */
export function createToastMessage(options: NotifyOptions = {}): ErrorMessageFunction {
  return async err => {
    const text = await err.getDisplayMessage()
    const message = err.response
      ? text === `HTTP ${err.status}`
        ? `Error: ${err.status}`
        : `Error: ${err.status} ${text}`
      : `Error: ${text}`
    showToast({ icon: 'error', ...options, text: message })
  }
}

/**
 * Creates an `errorMessageFunction` that shows the error in a modal box titled `Error: <status>`.
 * `options` customizes the box (`icon`, `confirmButtonText`); `title` and `text` are always replaced.
 *
 * @param options - Box options.
 * @returns The message function.
 */
export function createBoxMessage(options: NotifyOptions = {}): ErrorMessageFunction {
  return async err => {
    const text = await err.getDisplayMessage()
    const title = err.response ? `Error: ${err.status}` : 'Error'
    await showBox({ icon: 'error', ...options, title, text })
  }
}

/** Ready-to-use `errorMessageFunction` that shows errors in a toast (see {@link createToastMessage}). */
export const toastMessage: ErrorMessageFunction = createToastMessage()

/** Ready-to-use `errorMessageFunction` that shows errors in a modal box (see {@link createBoxMessage}). */
export const boxMessage: ErrorMessageFunction = createBoxMessage()
