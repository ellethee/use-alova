import { describe, expect, it, vi } from 'vitest'
import { STOP_PROCESSOR } from './pipeline'
import {
  createUseAlova,
  defaultErrorHandlers,
  defaultSuccessHandlers,
  getUseAlovaInstance,
} from './create'

describe('createUseAlova', () => {
  it('memoizes the result per url', () => {
    const useAlova = createUseAlova({ baseURL: '/api' })
    expect(useAlova({ url: '/a' })).toBe(useAlova({ url: '/a' }))
    expect(useAlova({ url: '/a' }).alova).not.toBe(useAlova({ url: '/b' }).alova)
    expect(useAlova()).toBe(useAlova())
    expect(createUseAlova({})().alova).not.toBe(useAlova().alova)
  })
  it('joins relative baseURL and url', () => {
    const useAlova = createUseAlova({ baseURL: '/api/' })
    expect(useAlova({ url: '/v1' }).alova.options.baseURL).toBe('/api/v1')
    expect(useAlova().alova.options.baseURL).toBe('/api/')
  })
  it('returns only the core helpers (no file helpers, no alova hooks)', () => {
    const keys = Object.keys(createUseAlova({})()).sort()
    expect(keys).toEqual(['$delete', '$get', '$patch', '$post', '$put', 'alova', 'useAlovaOptions'])
  })
  it('does not override defaults with undefined options', () => {
    const { useAlovaOptions } = createUseAlova({
      autoError: undefined,
      debug: undefined,
      authType: undefined,
    })()
    expect(useAlovaOptions.autoError).toBe(true)
    expect(useAlovaOptions.debug).toBe(false)
    expect(useAlovaOptions.authType).toBe('Bearer')
  })
  it('getUseAlovaInstance returns the last created hook', () => {
    const hook = createUseAlova({})
    expect(getUseAlovaInstance()).toBe(hook)
  })
  it('accepts null/undefined params', () => {
    const useAlova = createUseAlova({})
    expect(useAlova(null)).toBe(useAlova())
    expect(useAlova(undefined)).toBe(useAlova())
    expect(() => getUseAlovaInstance()(null)).not.toThrow()
  })
  it('null pipelines become [] and a null authHandler disables the default', () => {
    const { useAlovaOptions: o } = createUseAlova({
      errorHandlers: null,
      successHandlers: null,
      completeHandlers: null,
      authHandler: null,
    } as any)()
    expect(o.errorHandlers).toEqual([])
    expect(o.successHandlers).toEqual([])
    expect(o.completeHandlers).toEqual([])
    expect(o.authHandler).toBeNull()
  })
})

describe('default handler arrays', () => {
  it('are frozen: a consumer cannot change the defaults of every instance', () => {
    for (const list of [defaultErrorHandlers, defaultSuccessHandlers]) {
      expect(Object.isFrozen(list)).toBe(true)
      expect(() => (list as unknown as unknown[]).push(() => undefined)).toThrow(TypeError)
    }
    expect(defaultErrorHandlers).toHaveLength(1)
    expect(defaultSuccessHandlers).toHaveLength(1)
  })
  it('can be spread into custom handler lists', () => {
    const extra = vi.fn()
    const { useAlovaOptions: o } = createUseAlova({
      errorHandlers: [extra, ...defaultErrorHandlers],
    })()
    expect(o.errorHandlers).toHaveLength(2)
    expect(defaultErrorHandlers).toHaveLength(1)
  })
  it('are applied when the options are undefined', () => {
    const { useAlovaOptions: o } = createUseAlova({})()
    expect(o.errorHandlers).toBe(defaultErrorHandlers)
    expect(o.successHandlers).toBe(defaultSuccessHandlers)
    expect(o.completeHandlers).toEqual([])
    expect(o.authHandler).toBeTypeOf('function')
  })
})

describe('cacheFor option', () => {
  it('is not passed to alova by default, so its default applies (GET cached for 5 minutes)', () => {
    expect(createUseAlova({})().alova.options.cacheFor).toEqual({ GET: 300000 })
  })
  it('is passed to alova; null becomes { GET: null }', () => {
    expect(
      createUseAlova({ cacheFor: { GET: 1000, POST: null } })().alova.options.cacheFor
    ).toEqual({ GET: 1000, POST: null })
    expect(createUseAlova({ cacheFor: null })().alova.options.cacheFor).toEqual({ GET: null })
  })
})

describe('meta aliases in beforeRequest', () => {
  const run = async (meta: any, config: any = {}) => {
    const { alova } = createUseAlova({ authHandler: null })()
    const method = { config, meta, data: undefined }
    await (alova.options as any).beforeRequest(method)
    return method.config
  }
  it('copies boolean meta.autoError and meta.spinner to autoError and showOverlay', async () => {
    expect(await run({ autoError: false, spinner: true })).toMatchObject({
      autoError: false,
      showOverlay: true,
    })
  })
  it('the native config fields win over meta', async () => {
    expect(
      await run({ autoError: false, spinner: true }, { autoError: true, showOverlay: false })
    ).toMatchObject({ autoError: true, showOverlay: false })
  })
  it('ignores missing meta, non-booleans and unrelated keys', async () => {
    for (const meta of [undefined, {}, { autoError: 'no', spinner: 1 }, { other: true }]) {
      const config = await run(meta)
      expect(config.autoError).toBeUndefined()
      expect(config.showOverlay).toBeUndefined()
    }
  })
})

describe('alova cache logger', () => {
  it('is off by default and follows the debug option', () => {
    expect(createUseAlova({})().alova.options.cacheLogger).toBe(false)
    expect(createUseAlova({ debug: true })().alova.options.cacheLogger).toBe(true)
  })
})

describe('getUseAlovaInstance', () => {
  it('throws when no hook has been created yet', async () => {
    vi.resetModules()
    const fresh = await import('./create')
    expect(() => fresh.getUseAlovaInstance()).toThrow('not initialized')
  })
})

describe('beforeRequestHandlers', () => {
  /** Runs the `beforeRequest` hook of a fresh instance configured with the given entries. */
  async function run(entries: any[]): Promise<void> {
    const { alova } = createUseAlova({ authHandler: null, beforeRequestHandlers: entries })()
    await (alova.options as any).beforeRequest({ config: {}, data: undefined })
  }
  it('runs every entry in order when none stops', async () => {
    const calls: number[] = []
    await run([
      () => {
        calls.push(1)
      },
      () => {
        calls.push(2)
      },
    ])
    expect(calls).toEqual([1, 2])
  })
  it('runs the authHandler before the beforeRequestHandlers', async () => {
    const calls: string[] = []
    const { alova } = createUseAlova({
      authHandler: () => {
        calls.push('auth')
      },
      beforeRequestHandlers: [
        () => {
          calls.push('before')
        },
      ],
    })()
    await (alova.options as any).beforeRequest({ config: {}, data: undefined })
    expect(calls).toEqual(['auth', 'before'])
  })
  it.each([
    ['false', () => false],
    ['STOP_PROCESSOR', () => STOP_PROCESSOR],
  ])('stops the following entries when an entry returns %s', async (_name, stopper) => {
    const after = vi.fn()
    await run([stopper, after])
    expect(after).not.toHaveBeenCalled()
  })
  it('stops at a literal STOP_PROCESSOR element', async () => {
    const before = vi.fn()
    const after = vi.fn()
    await run([before, STOP_PROCESSOR, after])
    expect(before).toHaveBeenCalledOnce()
    expect(after).not.toHaveBeenCalled()
  })
})

describe('default responded', () => {
  it.each([100, 101, 301, 304])(
    'resolves null for status %i (neither 2xx nor >= 400)',
    async status => {
      const { alova } = createUseAlova({})()
      const responded = (alova.options as any).responded
      expect(await responded.onSuccess({ status } as Response, { config: {} })).toBeNull()
    }
  )
})
