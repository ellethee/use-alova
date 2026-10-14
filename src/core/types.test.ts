import { describe, expect, expectTypeOf, it } from 'vitest'
import { createUseAlova, defaultErrorHandlers, defaultSuccessHandlers } from './create'
import type {
  OverlayOptions,
  UseAlovaBeforeRequest,
  UseAlovaMethod,
  UseAlovaMethodConfig,
  UseAlovaResponseProcessor,
} from './types'
import { STOP_PROCESSOR } from './pipeline'
import type { ResponseError } from './response-error'

/**
 * Compile-time tests: they are checked by `pnpm typecheck` (tsconfig.test.json); the functions below are
 * never executed. A `@ts-expect-error` that stops erroring makes `tsc` fail.
 */
function typeChecks(): void {
  // Options
  createUseAlova({ baseURL: '/api', autoError: false, debug: true, defaultHeaders: { 'X-A': '1' } })
  createUseAlova({ token: 'T', authType: 'Token', authOrigins: ['https://a.example.com'] })
  createUseAlova({ token: async method => (method.url ? 'T' : null), authHandler: null })
  createUseAlova({
    errorMessageFunction: err => {
      void err.status
    },
  })
  createUseAlova({
    overlay: { mode: 'auto', delay: 200, show: () => undefined, hide: () => undefined },
  })
  createUseAlova({
    errorHandlers: [
      { 404: () => STOP_PROCESSOR, '401,403': () => undefined },
      ...defaultErrorHandlers,
    ],
    successHandlers: [({ result }) => result, ...defaultSuccessHandlers],
    completeHandlers: [() => undefined],
    beforeRequestHandlers: [
      method => {
        void method.config.headers
      },
      STOP_PROCESSOR,
    ],
  })
  // @ts-expect-error errorMessageFunction takes a function, not a string
  createUseAlova({ errorMessageFunction: 'toast' })
  // @ts-expect-error overlay.mode is 'manual' | 'auto'
  createUseAlova({ overlay: { mode: 'always' } })
  // @ts-expect-error store/storeKey were replaced by `token` in 2.0
  createUseAlova({ store: { token: 'T' } })
  // @ts-expect-error unknown option (the snake_case aliases are gone in 2.0)
  createUseAlova({ auto_error: false })
  // @ts-expect-error 'stop' is no longer accepted: use STOP_PROCESSOR
  createUseAlova({ beforeRequestHandlers: ['stop'] })

  // Per-request config
  const { $get, $post, alova, ...rest } = createUseAlova({})()
  // @ts-expect-error the alova hooks are imported from 'alova/client' in 2.0
  void rest.useRequest
  $get('/x', { showOverlay: true, autoError: false })
  alova.Get('/x', { showOverlay: false })
  const m = $get('/x', { autoError: false })
  const auto: boolean | undefined = m.config.autoError
  const show: boolean | undefined = m.config.showOverlay
  void [auto, show]
  // @ts-expect-error showOverlay must be a boolean
  $get('/x', { showOverlay: 'yes' })
  // @ts-expect-error autoError must be a boolean
  $get('/x', { autoError: 'no' })
  // @ts-expect-error unknown field (typo)
  $get('/x', { showOverlays: true })
  // @ts-expect-error cursorLoading was removed in 2.0
  $post('/x', {}, { cursorLoading: true })
}

describe('typed options and per-request config', () => {
  it('exposes the fields on UseAlovaMethodConfig and on method.config', () => {
    expectTypeOf<UseAlovaMethodConfig>().toHaveProperty('autoError')
    expectTypeOf<UseAlovaMethod['config']['autoError']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<UseAlovaMethod['config']['showOverlay']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<UseAlovaMethod['config']['fileName']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<UseAlovaMethod['config']['fieldName']>().toEqualTypeOf<string | undefined>()
    expect(typeof typeChecks).toBe('function')
  })
  it('handler types receive a method with the typed config', () => {
    const before: UseAlovaBeforeRequest = method => {
      const flag: boolean | undefined = method.config.showOverlay
      void flag
    }
    const processor: UseAlovaResponseProcessor = ({ method, error }) => {
      expectTypeOf(method).toEqualTypeOf<UseAlovaMethod>()
      expectTypeOf(error).toEqualTypeOf<ResponseError | undefined>()
    }
    expect(before).toBeTypeOf('function')
    expect(processor).toBeTypeOf('function')
  })
  it('OverlayOptions fields are all optional', () => {
    expectTypeOf<OverlayOptions>().toEqualTypeOf<{
      mode?: 'manual' | 'auto'
      delay?: number
      show?: () => void
      hide?: () => void
    }>()
  })
})
