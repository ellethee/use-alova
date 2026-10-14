import type {
  ResponseCodeKey,
  UseAlovaResponseProcessor,
  UseAlovaResponseProcessorOptions,
  UseAlovaResponseProcessorSet,
} from './types'
/**
 * Shared symbol used as a stop signal in the `use-alova` processor pipelines.
 *
 * It is the only real stop mechanism for `errorHandlers`/`successHandlers`/`completeHandlers`
 * (handled by `createProcessorHandler`): an entry can return it
 * directly, return the tuple `[value, STOP_PROCESSOR]` to stop with a specific
 * value, or appear as a literal array element to stop processing immediately
 * without running the following entries.
 *
 * It is also accepted (in addition to `false`) by the elements of `beforeRequestHandlers`.
 * It is created with `Symbol.for`, so it stays the same value even if the package is loaded twice
 * (ESM and CommonJS copies, duplicated installs).
 * The type is `unique symbol`: `scripts/postbuild.mjs` makes the declaration files of the subpaths import it from
 * the core declarations, so there is a single declaration of it.
 */
export const STOP_PROCESSOR: unique symbol = Symbol.for('@ilpachi/use-alova:stop')
/** Arguments of a pipeline run: the processor options without the `result`, with `retry`/`retried` optional. */
export type PipelineArgs = Omit<UseAlovaResponseProcessorOptions, 'result' | 'retry' | 'retried'> &
  Partial<Pick<UseAlovaResponseProcessorOptions, 'retry' | 'retried'>>

/** `retry` of a pipeline run that has no way to send the request again. */
const NO_RETRY = (): Promise<never> =>
  Promise.reject(new Error('[use-alova] retry() is not available here'))

/**
 * Parses a response code key string and returns an array of HTTP status codes.
 *
 * The key is a comma-separated list whose items are either a three-digit code (e.g. "404")
 * or a wildcard pattern using "xx" to represent a range (e.g. "4xx" for 400-499).
 * Invalid items (e.g. the "OK" in "200,OK", which is only a human-readable label) are ignored.
 *
 * @param key - The response code key(s) to parse.
 * @returns An array of HTTP status codes represented by the input key(s); never contains `NaN`.
 *
 * @example
 * parseCodeKey("404") // [404]
 * parseCodeKey("200,404") // [200, 404]
 * parseCodeKey("200,OK") // [200]
 * parseCodeKey("4xx") // [400, 401, ..., 499]
 * parseCodeKey("2xx,404") // [200, 201, ..., 299, 404]
 */
export function parseCodeKey(key: ResponseCodeKey | string): number[] {
  return String(key)
    .split(',')
    .flatMap(part => {
      part = part.trim()
      if (/^\dxx$/i.test(part)) {
        const base = parseInt(part[0]!, 10) * 100
        return Array.from({ length: 100 }, (_, i) => base + i)
      }
      if (/^\d{3}$/.test(part)) return [parseInt(part, 10)]
      return []
    })
}

/**
 * Creates a processor handler function that sequentially runs a set of response processors.
 * Each processor in the set can be a function, an object mapping response codes to handlers, or the `STOP_PROCESSOR` symbol.
 * The only way to stop processing is to return `STOP_PROCESSOR` (or the tuple `[value, STOP_PROCESSOR]`);
 * returning `false` has no special effect: it is assigned as the current result and processing continues with the next entry.
 *
 * @internal Internal engine powering the `errorHandlers`/`successHandlers`/`completeHandlers`
 * options of `createUseAlova`. It is not exported from `src/index.ts`: consumers do not call it
 * directly, but configure the entries that this function will run (see {@link UseAlovaResponseProcessor}
 * and {@link UseAlovaResponseProcessorMap} for how to write a custom entry).
 *
 * @param set - The set of response processors to run. Each element can be:
 *   - A function that processes the response and returns `STOP_PROCESSOR` (or `[value, STOP_PROCESSOR]`) to stop,
 *     another value to update the current result, or `undefined` to continue unchanged.
 *   - An object mapping response code keys to handler functions, with the same return semantics.
 *   - The `STOP_PROCESSOR` symbol to stop processing immediately.
 * @returns An async handler function that accepts an object with `options`, `response`, `method` and optionally `error`.
 *          The handler runs each processor in order and returns the last assigned result (or the one indicated by `STOP_PROCESSOR`), or `null` if none.
 *
 * @example
 * The four return forms a function entry can use:
 * ```ts
 * const set: UseAlovaResponseProcessorSet = [
 *   // 1. undefined -> continue, `result` stays as set by the previous entry.
 *   ({ result }) => { console.log('log side-effect', result) },
 *   // 2. a value -> becomes the new `result` for the next entry.
 *   ({ result }) => ({ ...result, normalizedAt: Date.now() }),
 *   // 3. STOP_PROCESSOR -> stop here, returning the `result` accumulated so far.
 *   ({ result }) => (result?.critical ? STOP_PROCESSOR : undefined),
 *   // 4. [value, STOP_PROCESSOR] -> stop here, returning `value` instead of `result`.
 *   () => [{ handled: true }, STOP_PROCESSOR],
 * ]
 * ```
 */
export function createProcessorHandler(set: UseAlovaResponseProcessorSet) {
  return async (args: PipelineArgs) => {
    const status = args.response?.status || null
    let lastResult: any = null
    for (const entry of set) {
      if (entry === STOP_PROCESSOR) return lastResult
      for (const processor of processorsFor(entry, status)) {
        const step = await runEntry(processor, args, lastResult)
        if (step.stop) return step.value
        lastResult = step.value
      }
    }
    return lastResult
  }
}

/**
 * Lists the functions a set entry runs for the given status: the entry itself when it is a function,
 * the handlers whose code key matches `status` when it is a status map (none without a status).
 *
 * @param entry - An element of the processor set.
 * @param status - The response status, or `null` when there is no response.
 * @returns The processors to run, in order (lazily evaluated).
 */
function* processorsFor(
  entry: unknown,
  status: number | null
): Generator<UseAlovaResponseProcessor> {
  if (typeof entry === 'function') {
    yield entry as UseAlovaResponseProcessor
  } else if (typeof entry === 'object' && entry !== null && status !== null) {
    for (const [key, handler] of Object.entries(entry)) {
      if (parseCodeKey(key).includes(status) && typeof handler === 'function') yield handler
    }
  }
}

/**
 * Runs one processor and interprets its return value.
 *
 * @param processor - The function to run.
 * @param args - The arguments of the pipeline.
 * @param lastResult - The result accumulated so far.
 * @returns `stop: true` with the final value when the processor returned `STOP_PROCESSOR` or
 *   `[value, STOP_PROCESSOR]`, otherwise `stop: false` with the new accumulated result (unchanged on `undefined`).
 */
async function runEntry(
  processor: UseAlovaResponseProcessor,
  args: PipelineArgs,
  lastResult: any
): Promise<{ stop: boolean; value: any }> {
  const result = await processor({ retry: NO_RETRY, retried: false, ...args, result: lastResult })
  if (Array.isArray(result) && result[1] === STOP_PROCESSOR) return { stop: true, value: result[0] }
  if (result === STOP_PROCESSOR) return { stop: true, value: lastResult }
  return { stop: false, value: result === undefined ? lastResult : result }
}
