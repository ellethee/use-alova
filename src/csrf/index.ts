/**
 * Optional CSRF support: a `beforeRequestHandlers` entry that sends the token from a cookie.
 *
 * @module
 */
export { csrfHandler } from './csrf-handler'
export type { CsrfOptions } from './csrf-handler'
export { getCookie } from './cookie'
