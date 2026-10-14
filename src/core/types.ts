import type { Alova, AlovaGenerics, AlovaGlobalCacheAdapter, Method } from 'alova'
import type { ResponseError } from './response-error'
import type { STOP_PROCESSOR } from './pipeline'

/**
 * Alova generics of the instances created by `createUseAlova` (fetch adapter + Vue states hook).
 *
 * @remarks
 * The request config type is `RequestInit & UseAlovaMethodConfig`: alova intersects it into the
 * config accepted by `Get`/`Post`/... and into `method.config`, so the `use-alova` per-request fields
 * are type-checked without augmenting any alova global type.
 */
export type UseAlovaGenerics = AlovaGenerics<
  any,
  any,
  RequestInit & UseAlovaMethodConfig,
  Response,
  Headers,
  AlovaGlobalCacheAdapter,
  AlovaGlobalCacheAdapter,
  any
>

/**
 * `use-alova`-specific fields that can be read/written in the config of a single request
 * (e.g. `$get(url, config)`), in addition to the standard Alova fields (`headers`, `params`, etc).
 * They are also typed on `method.config` inside the handlers.
 *
 * @property autoError - Overrides the global `autoError` for this request: `false` rethrows the error
 *   without calling `errorMessageFunction`. `method.meta.autoError` (boolean) is read as an alias; the config wins.
 * @property showOverlay - Per-request overlay switch: `true` shows the overlay (see the `overlay` option),
 *   `false` never shows it, even with `overlay.mode: 'auto'`. `method.meta.spinner` (boolean) is read as an alias; the config wins. Default: `overlay.mode` decides.
 * @property unwrapEnvelope - Overrides the global `unwrapEnvelope` for this request.
 * @property envelopeErrors - Overrides the global `envelopeErrors` for this request.
 * @property fileName - Used by `@ilpachi/use-alova/files`: marks the response as a file and names it when
 *   `Content-Disposition` has no `filename`. Default `'file.pdf'`.
 * @property fieldName - Used by `@ilpachi/use-alova/files`: `FormData` field of `$upload`.
 *   Default `'file'` for one file, `'files'` for an array.
 */
export interface UseAlovaMethodConfig {
  autoError?: boolean
  showOverlay?: boolean
  unwrapEnvelope?: boolean
  envelopeErrors?: 'data' | 'throw'
  fileName?: string
  fieldName?: string
}

/**
 * An alova `Method` created by a `use-alova` instance: `method.config` also includes the
 * {@link UseAlovaMethodConfig} fields. It is the `method` type received by the handlers.
 */
export type UseAlovaMethod = Method<UseAlovaGenerics>

/**
 * Argument of every entry of `successHandlers`, `errorHandlers` and `completeHandlers`.
 *
 * @property options - The resolved options of the instance.
 * @property response - The response (`undefined` for network errors).
 * @property method - The request method.
 * @property error - The error (error pipeline only).
 * @property result - The result accumulated by the previous entries.
 * @property retry - Sends the same request again (once) and resolves with the result of that second request,
 *   which goes through the whole pipeline again. Typical use: refresh the token, then retry. The headers are
 *   rebuilt, so `authHandler` picks up the new token. If the request was already retried, it rejects with
 *   `error` (or an `Error`): check `retried` first. A `ReadableStream` body cannot be sent twice.
 * @property retried - `true` when this run is already the result of a `retry()`.
 */
export interface UseAlovaResponseProcessorOptions {
  options: UseAlovaOptions
  response?: Response
  method: UseAlovaMethod
  error?: ResponseError
  result?: any
  retry: () => Promise<any>
  retried: boolean
}

/**
 * A pipeline entry: a function receiving {@link UseAlovaResponseProcessorOptions}.
 *
 * Return `undefined` to continue unchanged, any other value to replace the current result, `STOP_PROCESSOR`
 * (or the tuple `[value, STOP_PROCESSOR]`) to stop the pipeline. `false` and `null` are plain results:
 * the next entry still runs.
 *
 * @example
 * ```ts
 * const log: UseAlovaResponseProcessor = ({ result, method }) => {
 *   console.debug(`[${method.type}]`, result)
 *   return undefined // the pipeline continues with `result` untouched
 * }
 * ```
 */
export type UseAlovaResponseProcessor = (options: UseAlovaResponseProcessorOptions) => any

/**
 * Key of a status map: a code (`'404'`), a class (`'4xx'`) or a comma-separated list of them
 * (`'401,403'`, `'2xx,404'`).
 */
export type ResponseCodeKey =
  | `${number}`
  | `${number}xx`
  | `${number},${string}`
  | `${number}xx,${string}`

/**
 * Maps status keys to processors: only the functions whose key includes the current status run.
 *
 * @example
 * ```ts
 * const byStatus: UseAlovaResponseProcessorMap = {
 *   '404': () => STOP_PROCESSOR,
 *   '401,403': () => { location.assign('/login'); return STOP_PROCESSOR },
 * }
 * ```
 */
export type UseAlovaResponseProcessorMap = Partial<
  Record<ResponseCodeKey, UseAlovaResponseProcessor>
>

/** One element of a pipeline set: a function, a status map or the `STOP_PROCESSOR` marker. */
export type UseAlovaResponseProcessorEntry =
  | UseAlovaResponseProcessor
  | UseAlovaResponseProcessorMap
  | typeof STOP_PROCESSOR

/** The value of `successHandlers`, `errorHandlers` and `completeHandlers`. */
export type UseAlovaResponseProcessorSet = readonly UseAlovaResponseProcessorEntry[]

/**
 * Function run before a request is sent (`authHandler`, `beforeRequestHandlers`). It may be asynchronous
 * (it is awaited) and mutate `method.config`. In `beforeRequestHandlers`, returning `false` or
 * `STOP_PROCESSOR` skips the following entries.
 */
export type UseAlovaBeforeRequest = (
  method: UseAlovaMethod,
  options: UseAlovaOptions
) =>
  | void
  | null
  | undefined
  | boolean
  | typeof STOP_PROCESSOR
  | Promise<void | null | undefined | boolean | typeof STOP_PROCESSOR>

/**
 * Adapter that shows and hides a "busy" indicator. The core has no DOM: it only counts the requests and
 * calls these functions; `@ilpachi/use-alova/overlay` provides a ready DOM implementation.
 *
 * @property mode - `'manual'` (default): only requests with `showOverlay: true` show it. `'auto'`: every
 *   request shows it, except those with `showOverlay: false`.
 * @property delay - Milliseconds to wait before calling `show` (default `0`). A request that ends earlier
 *   shows nothing: no flicker on fast responses.
 * @property show - Called when the first request that wants the overlay is pending.
 * @property hide - Called when the last of them ends (success, error or abort).
 */
export interface OverlayOptions {
  mode?: 'manual' | 'auto'
  delay?: number
  show?: () => void
  hide?: () => void
}

/**
 * Options of `createUseAlova` / `UseAlovaPlugin`. Options explicitly set to `undefined` keep their default.
 *
 * @property baseURL - Prefix of every request.
 * @property debug - Logs request errors and failures of the message function, and alova's `[HitCache]` messages.
 * @property autoError - Calls `errorMessageFunction` before rethrowing an error (default `true`).
 * @property cacheFor - Global alova cache time per HTTP method (`number` ms, `Date`, or `null` for none). Default: alova's own
 *   (GET cached for 5 minutes). `null` or `{ GET: null }` disables the cache. A request can override it with its own `cacheFor`.
 * @property defaultHeaders - Headers merged into every request (case-insensitively, the request wins).
 * @property token - Token of the default `authHandler`: a string, or a function called for every request
 *   (it may be asynchronous and return a falsy value for "no token"), e.g. `() => userStore.token`.
 * @property authType - Scheme of the `Authorization` header (default `'Bearer'`): a string, or a function called for
 *   every request (e.g. the `token_type` sent by the backend) that returns `undefined` or `''` to use `'Bearer'`.
 * @property authOrigins - Extra origins that may receive `Authorization` on absolute-url requests.
 * @property authHandler - Sets the authentication; `null` disables it.
 * @property beforeRequestHandlers - Functions run before each request, after `authHandler`.
 * @property successHandlers - Pipeline for 2xx responses (default: JSON/text parsing).
 * @property errorHandlers - Pipeline for errors (default: show the message and rethrow).
 * @property completeHandlers - Pipeline run when the request completes (default: none).
 * @property unwrapEnvelope - Resolves 2xx JSON responses shaped `{ success, message?, data }` with just `data`
 *   (default `false`). JSON without a boolean `success` and a `data` key is returned unchanged. Overridable per request.
 * @property envelopeErrors - With `unwrapEnvelope`, what a 2xx envelope with `success: false` does: `'data'` (default)
 *   resolves with its `data`; `'throw'` rejects with a `ResponseError` (same status, `message` from the envelope) that
 *   goes through the error pipeline. Overridable per request.
 * @property errorMessageFunction - Shows the error to the user (default: nothing is shown).
 * @property overlay - Busy-indicator adapter (default: none).
 */
export interface UseAlovaOptions {
  baseURL?: string | undefined
  debug?: boolean | undefined
  autoError?: boolean | undefined
  cacheFor?:
    | Partial<
        Record<
          'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS',
          number | Date | null
        >
      >
    | null
    | undefined
  defaultHeaders?: Record<string, string> | undefined
  token?:
    | string
    | ((method: UseAlovaMethod) => string | null | undefined | Promise<string | null | undefined>)
    | undefined
  authType?: string | ((method: UseAlovaMethod) => string | undefined) | undefined
  authOrigins?: string[] | undefined
  authHandler?: UseAlovaBeforeRequest | null | undefined
  beforeRequestHandlers?: (UseAlovaBeforeRequest | typeof STOP_PROCESSOR)[] | undefined
  successHandlers?: UseAlovaResponseProcessorSet | undefined
  errorHandlers?: UseAlovaResponseProcessorSet | undefined
  completeHandlers?: UseAlovaResponseProcessorSet | undefined
  unwrapEnvelope?: boolean | undefined
  envelopeErrors?: 'data' | 'throw' | undefined
  errorMessageFunction?: ((err: ResponseError) => Promise<void> | void) | undefined
  overlay?: OverlayOptions | undefined
}

/**
 * Result of `useAlova(params)`.
 *
 * @property alova - The alova instance.
 * @property useAlovaOptions - The resolved options.
 * @property $get - Creates a GET method (also `$post`, `$put`, `$patch`, `$delete`): methods are lazy,
 *   `await` them, call `.send()` or pass them to a hook from `alova/client` (`useRequest`, ...).
 */
export type UseAlovaReturn = {
  alova: Alova<UseAlovaGenerics>
  useAlovaOptions: UseAlovaOptions
  $post: Alova<UseAlovaGenerics>['Post']
  $get: Alova<UseAlovaGenerics>['Get']
  $put: Alova<UseAlovaGenerics>['Put']
  $patch: Alova<UseAlovaGenerics>['Patch']
  $delete: Alova<UseAlovaGenerics>['Delete']
}
