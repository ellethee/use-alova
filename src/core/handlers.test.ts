import { describe, expect, it, vi } from 'vitest'
import type { UseAlovaMethod } from './types'
import { ResponseError } from './response-error'
import { EnvelopeFailure, defaultErrorHandler, defaultJsonHandler } from './handlers'

const mk = (type: string, url: string) =>
  ({ type, url, config: { headers: {} } }) as unknown as UseAlovaMethod

describe('defaultJsonHandler', () => {
  const run = (body: string, type?: string) =>
    defaultJsonHandler({
      response: new Response(body, { headers: type ? { 'content-type': type } : {} }),
    } as any)
  it('parses JSON', async () => {
    expect(await run('{"a":1}', 'application/json')).toEqual({ a: 1 })
  })
  it('parses JSON without a JSON content type', async () => {
    expect(await run('{"a":1}')).toEqual({ a: 1 })
  })
  it('returns null for an empty body', async () => {
    expect(await run('', 'application/json')).toBeNull()
  })
  it('propagates parse errors when content-type is JSON', async () => {
    await expect(run('nope', 'application/json')).rejects.toThrow()
  })
  it('falls back to text for other types', async () => {
    expect(await run('hello', 'text/plain')).toBe('hello')
  })
  it('skips a consumed body and a missing response', async () => {
    const response = new Response('{"a":1}')
    await response.text()
    expect(await defaultJsonHandler({ response } as any)).toBeNull()
    expect(await defaultJsonHandler({} as any)).toBeNull()
  })
})

describe('defaultErrorHandler', () => {
  it('rethrows and does not show aborts', () => {
    const fn = vi.fn()
    const error = new ResponseError(new DOMException('x', 'AbortError'), { messageFunction: fn })
    expect(() => defaultErrorHandler({ options: {}, method: mk('GET', '/'), error })).toThrow(error)
    expect(fn).not.toHaveBeenCalled()
  })
  it('shows the message and rethrows when a message function is configured', () => {
    const fn = vi.fn()
    const error = new ResponseError(new Response('', { status: 500 }), { messageFunction: fn })
    expect(() => defaultErrorHandler({ options: {}, method: mk('GET', '/'), error })).toThrow(error)
    expect(fn).toHaveBeenCalledOnce()
  })
  it('rethrows silently without a message function', () => {
    const error = new ResponseError(new Response('', { status: 500 }))
    expect(() => defaultErrorHandler({ options: {}, method: mk('GET', '/'), error })).toThrow(error)
  })
  it('swallows showMessage failures, logging them only with debug', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mkError = () =>
      new ResponseError(new Response('', { status: 500 }), {
        messageFunction: () => Promise.reject(new Error('boom')),
      })
    expect(() =>
      defaultErrorHandler({ options: {}, method: mk('GET', '/'), error: mkError() })
    ).toThrow()
    await new Promise(r => setTimeout(r, 0))
    expect(spy).not.toHaveBeenCalled()
    expect(() =>
      defaultErrorHandler({ options: { debug: true }, method: mk('GET', '/'), error: mkError() })
    ).toThrow()
    await new Promise(r => setTimeout(r, 0))
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
  it('swallows a synchronously throwing message function', () => {
    const error = new ResponseError(new Response('', { status: 500 }), {
      messageFunction: () => {
        throw new Error('sync')
      },
    })
    expect(() => defaultErrorHandler({ options: {}, method: mk('GET', '/'), error })).toThrow(error)
  })
  it('respects autoError=false per request and globally; the request wins', () => {
    const run = (global: boolean | undefined, request: boolean | undefined): number => {
      const fn = vi.fn()
      const error = new ResponseError(new Response('', { status: 500 }), { messageFunction: fn })
      const m = mk('GET', '/')
      m.config.autoError = request
      expect(() =>
        defaultErrorHandler({ options: { autoError: global }, method: m, error })
      ).toThrow()
      return fn.mock.calls.length
    }
    expect(run(undefined, undefined)).toBe(1)
    expect(run(true, false)).toBe(0)
    expect(run(false, undefined)).toBe(0)
    expect(run(false, true)).toBe(1)
  })
})

describe('defaultJsonHandler: unwrapEnvelope', () => {
  const body = (value: unknown, type = 'application/json') =>
    new Response(typeof value === 'string' ? value : JSON.stringify(value), {
      headers: { 'content-type': type },
    })
  const run = (value: unknown, unwrap?: boolean, requestUnwrap?: boolean, type?: string) =>
    defaultJsonHandler({
      response: body(value, type),
      method: { config: { unwrapEnvelope: requestUnwrap } },
      options: { unwrapEnvelope: unwrap },
    } as any)

  it('is off by default', async () => {
    expect(await run({ success: true, data: 1 })).toEqual({ success: true, data: 1 })
    expect(await run({ success: true, data: 1 }, false)).toEqual({ success: true, data: 1 })
  })
  it('returns data of { success, message, data }, whatever the value of data', async () => {
    expect(await run({ success: true, message: 'ok', data: { a: 1 } }, true)).toEqual({ a: 1 })
    expect(await run({ success: true, data: [1, 2] }, true)).toEqual([1, 2])
    expect(await run({ success: true, data: null }, true)).toBeNull()
    expect(await run({ success: true, data: 0 }, true)).toBe(0)
    expect(await run({ success: false, message: 'x', data: 'y' }, true)).toBe('y')
  })
  it('requires a boolean success and a data key; arrays, strings and numbers pass through', async () => {
    for (const value of [
      { access_token: 'x' },
      { success: true },
      { data: 1 },
      { success: 'yes', data: 1 },
      [{ success: true, data: 1 }],
      5,
      null,
    ]) {
      expect(await run(value, true), JSON.stringify(value)).toEqual(value)
    }
    expect(await run('"text"', true)).toBe('text')
  })
  it('the request config wins over the option', async () => {
    expect(await run({ success: true, data: 1 }, true, false)).toEqual({ success: true, data: 1 })
    expect(await run({ success: true, data: 1 }, false, true)).toBe(1)
  })
  it('also unwraps JSON served without a JSON content type, but never plain text', async () => {
    expect(await run({ success: true, data: 1 }, true, undefined, 'text/plain')).toBe(1)
    expect(await run('not json', true, undefined, 'text/plain')).toBe('not json')
  })
  it('empty bodies stay null', async () => {
    expect(await run('', true)).toBeNull()
  })
})

describe('defaultJsonHandler: envelopeErrors', () => {
  const run = (
    value: unknown,
    mode?: 'data' | 'throw',
    requestMode?: 'data' | 'throw',
    unwrap = true
  ) =>
    defaultJsonHandler({
      response: new Response(JSON.stringify(value), {
        headers: { 'content-type': 'application/json' },
      }),
      method: { config: { envelopeErrors: requestMode } },
      options: { unwrapEnvelope: unwrap, envelopeErrors: mode },
    } as any)

  it("'data' (default) keeps returning data for success: false", async () => {
    expect(await run({ success: false, message: 'no', data: 7 })).toBe(7)
    expect(await run({ success: false, data: 7 }, 'data')).toBe(7)
  })
  it("'throw' throws an EnvelopeFailure with the message and the raw body", async () => {
    const err = await run({ success: false, message: 'no', data: 7 }, 'throw').catch(e => e)
    expect(err).toBeInstanceOf(EnvelopeFailure)
    expect(err.message).toBe('no')
    expect(JSON.parse(err.text)).toEqual({ success: false, message: 'no', data: 7 })
  })
  it('a missing or non-string message is left to the status text', async () => {
    for (const message of [undefined, 5, '', null]) {
      const err = await run({ success: false, message, data: null }, 'throw').catch(e => e)
      expect(err.envelopeMessage).toBeUndefined()
    }
  })
  it("'throw' does not affect success: true, non-envelopes, or a disabled unwrapEnvelope", async () => {
    expect(await run({ success: true, data: 1 }, 'throw')).toBe(1)
    expect(await run({ success: false }, 'throw')).toEqual({ success: false })
    expect(await run({ success: false, data: 1 }, 'throw', undefined, false)).toEqual({
      success: false,
      data: 1,
    })
  })
  it('the request config wins over the option', async () => {
    expect(await run({ success: false, data: 1 }, 'throw', 'data')).toBe(1)
    await expect(run({ success: false, data: 1 }, 'data', 'throw')).rejects.toBeInstanceOf(
      EnvelopeFailure
    )
  })
})
