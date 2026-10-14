import type { Method, RespondedHandlerRecord } from 'alova'
import { createAlova } from 'alova'
import adapterFetch from 'alova/fetch'
import VueHook from 'alova/vue'
import type {
  UseAlovaMethod,
  UseAlovaOptions,
  UseAlovaResponseProcessor,
  UseAlovaResponseProcessorOptions,
  UseAlovaReturn,
} from './types'
import { ResponseError } from './response-error'
import { STOP_PROCESSOR, createProcessorHandler } from './pipeline'
import { createOverlayController } from './overlay'
import type { OverlayController } from './overlay'
import { ensureRawBodyContentType } from './body'
import { omitUndefined, withDefault } from './options'
import { joinUrl } from './url'
import { mergeHeaders } from './headers'
import { defaultParams, defaultOptions } from './defaults'
import { EnvelopeFailure, defaultErrorHandler, defaultJsonHandler } from './handlers'
import { defaultAuthHandler } from './auth'

/** The `useAlova` function returned by `createUseAlova`. */
type UseAlovaFactory = (params?: { url?: string } | null) => UseAlovaReturn

let cachedInstance: UseAlovaFactory | null = null

/** `meta` key that marks a method created by `retry()`. */
const RETRIED_META_KEY = '__useAlovaRetried'

/** Request headers as the caller set them, before the handlers touched them (per method sent). */
const originalHeaders = new WeakMap<object, Record<string, any>>()

/**
 * Abort functions (the `method.abort` object that a method shares with its clones and with the requests sent by
 * `retry()`) that were called since the last request started.
 */
const abortedRequests = new WeakSet<object>()

/**
 * Remembers when the caller aborts a request, even after the request has already finished: `method.abort()` is
 * then a no-op for alova, but a `retry()` must not start. A new request clears the mark.
 *
 * @param method - The method about to be sent.
 */
function trackAbort(method: UseAlovaMethod): void {
  const abort = method.abort as unknown as { a: () => Promise<void> } | undefined
  if (!abort) return
  abortedRequests.delete(abort)
  const original = abort.a
  abort.a = () => {
    abortedRequests.add(abort)
    return original()
  }
}

/**
 * Tells whether the caller aborted the request (`method.abort()`, a hook's `abort`, or the `AbortSignal` of the config).
 *
 * @param method - The method received by a handler.
 * @returns `true` if a retry must not start.
 */
function isAborted(method: UseAlovaMethod): boolean {
  return (
    Boolean(method.abort && abortedRequests.has(method.abort)) ||
    Boolean(method.config.signal?.aborted)
  )
}

/**
 * Tells whether a method is the result of a `retry()`.
 *
 * @param method - The method received by a handler.
 * @returns `true` if it was created by `retry()`.
 */
function isRetried(method: UseAlovaMethod): boolean {
  return Boolean((method.meta as Record<string, unknown> | undefined)?.[RETRIED_META_KEY])
}

/**
 * Sends a request again, once: restores the headers the caller set (so `authHandler` and the other
 * handlers run again, e.g. with a refreshed token), marks the new request and resolves with its result.
 *
 * @param method - The method received by a handler.
 * @param error - The error to reject with when the request was already retried.
 * @returns The result of the second request (it went through the whole pipeline). It rejects with an abort
 *   `ResponseError` (`isAbort`) without sending anything when the caller aborted the request.
 */
function retryRequest(method: UseAlovaMethod, error?: Error): Promise<any> {
  if (isAborted(method))
    return Promise.reject(
      new ResponseError(new DOMException('The request was aborted', 'AbortError'))
    )
  if (isRetried(method))
    return Promise.reject(error ?? new Error('[use-alova] the request was already retried'))
  const original = originalHeaders.get(method)
  if (original) method.config.headers = { ...original }
  method.meta = { ...method.meta, [RETRIED_META_KEY]: true }
  return method.send(true)
}

/**
 * Builds the `retry`/`retried` part of the processor options for a method.
 *
 * @param method - The request method.
 * @param error - The error of the error pipeline, if any.
 * @returns `retry` and `retried`.
 */
function retryContext(
  method: UseAlovaMethod,
  error?: Error
): Pick<UseAlovaResponseProcessorOptions, 'retry' | 'retried'> {
  return { retry: () => retryRequest(method, error), retried: isRetried(method) }
}

/**
 * Default error pipeline: shows the message (when an `errorMessageFunction` is configured) and rethrows.
 * Frozen (shared by all instances): to add entries build a new array
 * (`errorHandlers: [myHandler, ...defaultErrorHandlers]`).
 */
export const defaultErrorHandlers: readonly UseAlovaResponseProcessor[] = Object.freeze([
  defaultErrorHandler,
])
/**
 * Default success pipeline: JSON/text parsing. Frozen: spread it into a new array to add entries
 * (`successHandlers: [myHandler, ...defaultSuccessHandlers]`).
 */
export const defaultSuccessHandlers: readonly UseAlovaResponseProcessor[] = Object.freeze([
  defaultJsonHandler,
])

/**
 * Wraps a responded record so that the overlay held by the method is always released, once per request
 * (the release is idempotent per method, so `onSuccess` + `onComplete` do not release twice).
 *
 * @param record - The responded handlers.
 * @param overlay - The overlay controller.
 * @returns A new record with `onSuccess`, `onError` and `onComplete` always defined.
 */
function withOverlayRelease(
  record: Required<RespondedHandlerRecord<any>>,
  overlay: OverlayController
): Required<RespondedHandlerRecord<any>> {
  return {
    // The overlay is released before running the user handlers (they may open dialogs/toasts that
    // the overlay would cover); the idempotent release is also guaranteed afterwards.
    onSuccess: async (response: Response, method: Method) => {
      overlay.release(method as UseAlovaMethod)
      return await record.onSuccess(response, method)
    },
    onError: async (err: any, method: Method) => {
      overlay.release(method as UseAlovaMethod)
      return await record.onError(err, method)
    },
    onComplete: async (method: Method) => {
      overlay.release(method as UseAlovaMethod)
      return await record.onComplete(method)
    },
  }
}

/**
 * Factory that creates a `useAlova` hook: a preconfigured alova instance (fetch adapter, Vue states) with
 * authentication, header merging, a response pipeline and error handling.
 *
 * @param options - See {@link UseAlovaOptions}.
 * @returns A `useAlova(params?)` function. `params.url` is appended to `baseURL`; the result is memoized per
 *   `url` and contains `alova`, `useAlovaOptions`, `$get`, `$post`, `$put`, `$patch` and `$delete`.
 *
 * @example
 * ```typescript
 * const useApi = createUseAlova({ baseURL: '/api' })
 * const { $get, $post } = useApi({ url: '/users' })
 * await $get('/list')
 * ```
 */
export function createUseAlova(options: UseAlovaOptions): UseAlovaFactory {
  options = {
    ...defaultOptions,
    ...omitUndefined(options),
  }
  const overlay = createOverlayController(options.overlay)
  options.errorHandlers = withDefault(options.errorHandlers, defaultErrorHandlers, [])
  options.successHandlers = withDefault(options.successHandlers, defaultSuccessHandlers, [])
  options.completeHandlers = withDefault(options.completeHandlers, [], [])
  options.authHandler = withDefault(options.authHandler, defaultAuthHandler, null)

  /** One result per `url`, so that the alova instance (cache, states) is shared. */
  const instances = new Map<string, UseAlovaReturn>()

  const errorProcessor = createProcessorHandler(options.errorHandlers!)
  const successProcessor = createProcessorHandler(options.successHandlers!)
  const completeProcessor = createProcessorHandler(options.completeHandlers!)
  const newError = (source: Response | Error): ResponseError =>
    new ResponseError(source, { messageFunction: options.errorMessageFunction })

  /**
   * Returns the (memoized) alova instance and helpers for a `url`.
   *
   * @param params - Optional parameters (`null`/`undefined` are accepted).
   * @param params.url - URL appended to `options.baseURL` (plain join). The same `url` always returns the same
   *   result. Every distinct `url` creates (and keeps) a new alova instance, so do not pass dynamic values
   *   (ids, query strings, ...) here: use the per-request url (`$get('/users/' + id)`).
   * @returns The alova instance and the `$get`/`$post`/... helpers.
   */
  function useAlova(params?: { url?: string } | null): UseAlovaReturn {
    const url = (params ?? defaultParams).url
    const cacheKey = url ?? ''
    const existing = instances.get(cacheKey)
    if (existing) return existing
    const fetchAdapter = adapterFetch()
    const baseURL = options.baseURL ? joinUrl(options.baseURL, url) : (url ?? '')
    const responded = withOverlayRelease(
      {
        onSuccess: async (response: Response, method: Method) => {
          const m = method as UseAlovaMethod
          if (response.status >= 400) {
            const error = newError(response)
            return (
              (await errorProcessor({
                options,
                response,
                method: m,
                error,
                ...retryContext(m, error),
              })) ?? null
            )
          }
          if (response.status >= 200 && response.status < 300) {
            try {
              return await successProcessor({ options, response, method: m, ...retryContext(m) })
            } catch (e) {
              if (!(e instanceof EnvelopeFailure)) throw e
              // `envelopeErrors: 'throw'`: the body is consumed, so the error carries a copy of the response.
              const copy = new Response(e.text, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              })
              const error = newError(copy)
              if (e.envelopeMessage) error.message = e.envelopeMessage
              return (
                (await errorProcessor({
                  options,
                  response: copy,
                  method: m,
                  error,
                  ...retryContext(m, error),
                })) ?? null
              )
            }
          }
          return null
        },
        onError: (err: unknown, method: Method) => {
          if (options.debug) console.error('Inside alova Request error', err)
          const m = method as UseAlovaMethod
          const error = newError(err as Error)
          return errorProcessor({
            options,
            response: error.response,
            method: m,
            error,
            ...retryContext(m, error),
          })
        },
        onComplete: async (method: Method) => {
          const m = method as UseAlovaMethod
          return await completeProcessor({ options, method: m, ...retryContext(m) })
        },
      },
      overlay
    )
    const alovaInstance = createAlova({
      baseURL,
      statesHook: VueHook,
      // The overlay is acquired by the adapter, i.e. only when the request really goes to the network: alova
      // calls `beforeRequest` also for cache hits, but never the adapter.
      requestAdapter: (elements: any, method: any) => {
        overlay.acquire(method as unknown as UseAlovaMethod)
        return fetchAdapter(elements, method)
      },
      // alova prints `[HitCache]` on every cache hit unless told otherwise: only when `debug` is on.
      cacheLogger: options.debug ?? false,
      ...(options.cacheFor === undefined
        ? {}
        : { cacheFor: options.cacheFor === null ? { GET: null } : (options.cacheFor as any) }),
      responded,
      async beforeRequest(rawMethod) {
        // The adapter-inferred generics differ from `UseAlovaGenerics` only in the cache adapter types.
        const method = rawMethod as unknown as UseAlovaMethod
        originalHeaders.set(method, { ...method.config.headers })
        trackAbort(method)
        // `meta.autoError` / `meta.spinner` are aliases of the config fields (the config wins).
        const meta = method.meta as { autoError?: unknown; spinner?: unknown } | undefined
        if (typeof meta?.autoError === 'boolean') method.config.autoError ??= meta.autoError
        if (typeof meta?.spinner === 'boolean') method.config.showOverlay ??= meta.spinner
        method.config.headers = mergeHeaders(options.defaultHeaders, method.config.headers)
        // alova forces `Content-Type: application/json` on raw bodies (URLSearchParams, Blob, ...): fix it.
        ensureRawBodyContentType(method)
        // `authHandler` always runs first (it is not interruptible), then the beforeRequestHandlers loop
        // (which can stop itself).
        if (options.authHandler) await options.authHandler(method, options)
        if (options.beforeRequestHandlers) {
          for (const entry of options.beforeRequestHandlers) {
            if (entry === STOP_PROCESSOR) break
            if (typeof entry === 'function') {
              const result = await entry(method, options)
              if (result === false || result === STOP_PROCESSOR) break
            }
          }
        }
        // A handler may have added a header under another spelling of one already present
        // (e.g. `Authorization` vs a default `authorization`): fetch would merge them into `a, b`.
        // Normalize again so that exactly one value is sent (the last one set wins).
        method.config.headers = mergeHeaders(method.config.headers)
      },
    }) as unknown as UseAlovaReturn['alova']
    const result: UseAlovaReturn = {
      alova: alovaInstance,
      useAlovaOptions: options,
      // Bound: alova's methods use `this`, so they must keep working when destructured.
      $post: alovaInstance.Post.bind(alovaInstance) as UseAlovaReturn['$post'],
      $get: alovaInstance.Get.bind(alovaInstance) as UseAlovaReturn['$get'],
      $put: alovaInstance.Put.bind(alovaInstance) as UseAlovaReturn['$put'],
      $patch: alovaInstance.Patch.bind(alovaInstance) as UseAlovaReturn['$patch'],
      $delete: alovaInstance.Delete.bind(alovaInstance) as UseAlovaReturn['$delete'],
    }
    instances.set(cacheKey, result)
    return result
  }
  cachedInstance = useAlova
  return useAlova
}

/**
 * Returns the `useAlova` hook created last (by `createUseAlova` or, indirectly, by `UseAlovaPlugin`).
 * With several apps/factories the last one wins: prefer `inject(USE_ALOVA_KEY)` / `$useAlova`, which are per app.
 * Useful in non-Vue contexts where DI is not available.
 *
 * @returns The last created hook.
 * @throws Error when no hook has been created yet.
 */
export function getUseAlovaInstance(): UseAlovaFactory {
  if (cachedInstance) {
    return cachedInstance
  }
  throw new Error('Alova instance not initialized. Please call createUseAlova first.')
}
