import type { UseAlovaOptions, UseAlovaResponseProcessorOptions } from './types'

/**
 * Handles API request errors by optionally showing an error message and rethrowing the error.
 *
 * Calls `error.showMessage()` (the configured `errorMessageFunction`, if any) unless the request has
 * `autoError: false` (or the global `autoError` is `false`) or the error is an abort. The message is not
 * awaited: a failure while showing it never becomes an unhandled rejection (it is logged with
 * `console.error` only when `options.debug` is set). The error is then rethrown.
 *
 * If a later entry of the pipeline returns `STOP_PROCESSOR`, the rethrow is not reached by that entry:
 * after a STOP the error is swallowed and the request resolves with `null`.
 *
 * @param args - The processor arguments.
 * @param args.options - The options object containing the error handling configuration.
 * @param args.method - The method object, which may contain a `config` property with `autoError`.
 * @param args.error - The error object.
 *
 * @throws The provided error, after optionally showing its message.
 */
export function defaultErrorHandler({
  options,
  method,
  error,
}: Pick<UseAlovaResponseProcessorOptions, 'options' | 'method' | 'error'>): void {
  const auto = method.config.autoError ?? options.autoError ?? true
  if (auto && error && !error.isAbort) {
    try {
      Promise.resolve(error.showMessage()).catch(reportShowError(options))
    } catch (e) {
      reportShowError(options)(e)
    }
  }
  throw error
}

/**
 * Builds a rejection handler for `showMessage()` that swallows the failure,
 * logging it with `console.error` only when `options.debug` is enabled.
 *
 * @param options - The `use-alova` options.
 * @returns A function that receives the failure reason.
 */
function reportShowError(options: UseAlovaOptions): (reason: unknown) => void {
  return (reason: unknown) => {
    if (options.debug) console.error('[use-alova] showMessage failed', reason)
  }
}

/**
 * Thrown by `defaultJsonHandler` for a 2xx envelope with `success: false` when `envelopeErrors` is `'throw'`.
 * `createUseAlova` turns it into a `ResponseError` and runs the error pipeline.
 *
 * @internal
 */
export class EnvelopeFailure extends Error {
  /**
   * @param text - The raw response body (the envelope).
   * @param envelopeMessage - The envelope `message`, when it is a non-empty string.
   */
  constructor(
    public readonly text: string,
    public readonly envelopeMessage?: string
  ) {
    super(envelopeMessage ?? 'The response reports success: false')
    this.name = 'EnvelopeFailure'
  }
}

/**
 * Tells whether a parsed JSON value is an API envelope `{ success, message?, data }`.
 *
 * @param value - The parsed JSON.
 * @returns `true` for a plain object with a boolean `success` and a `data` key.
 */
function isEnvelope(value: unknown): value is { success: boolean; data: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { success?: unknown }).success === 'boolean' &&
    'data' in value
  )
}

/**
 * Handles the body of a successful response.
 * Returns `null` when the body has already been consumed (`bodyUsed`).
 *
 * Reads the body as text once:
 * - an empty body resolves to `null`;
 * - if the `Content-Type` says JSON, the text is parsed and a parse failure is propagated (not ignored);
 * - otherwise the text is parsed as JSON when possible, falling back to the plain text.
 *
 * With `unwrapEnvelope` (the option, or `method.config.unwrapEnvelope` for one request) a JSON envelope
 * `{ success, message?, data }` resolves with just `data`; any other JSON is returned unchanged. With
 * `envelopeErrors: 'throw'` an envelope with `success: false` throws an `EnvelopeFailure` instead.
 *
 * @param options - An object containing the `response`, the `method` and the `options`.
 * @returns A Promise that resolves to the parsed JSON, the plain text, or `null` if the response or body is empty.
 * @throws A `SyntaxError` when the content type is JSON but the body is not valid JSON.
 */
export async function defaultJsonHandler({
  response,
  method,
  options,
}: UseAlovaResponseProcessorOptions): Promise<any> {
  if (!response || response.bodyUsed) return null
  const text = await response.text()
  if (!text) return null
  const unwrap = method?.config?.unwrapEnvelope ?? options?.unwrapEnvelope ?? false
  const mode = method?.config?.envelopeErrors ?? options?.envelopeErrors ?? 'data'
  const finish = (value: unknown): unknown => {
    if (!unwrap || !isEnvelope(value)) return value
    if (!value.success && mode === 'throw') {
      const message = (value as { message?: unknown }).message
      throw new EnvelopeFailure(text, typeof message === 'string' && message ? message : undefined)
    }
    return value.data
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (/json/i.test(contentType)) return finish(JSON.parse(text))
  try {
    return finish(JSON.parse(text))
  } catch {
    return text
  }
}
