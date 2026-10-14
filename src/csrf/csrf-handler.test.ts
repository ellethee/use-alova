import { afterEach, describe, expect, it } from 'vitest'
import type { UseAlovaMethod, UseAlovaOptions } from '../core/types'
import { csrfHandler } from './csrf-handler'

const mk = (type: string, url: string, headers: Record<string, any> = {}, baseURL?: string) =>
  ({ type, url, baseURL, config: { headers } }) as unknown as UseAlovaMethod
const run = (
  handler: ReturnType<typeof csrfHandler>,
  method: UseAlovaMethod,
  options: UseAlovaOptions = {}
) => handler(method, options)
const handler = csrfHandler({ cookieName: 'csrf', headerName: 'X-CSRF' })

afterEach(() => {
  for (const name of ['csrf', 'csrftoken', 'camel'])
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
})

describe('csrfHandler', () => {
  it('never overwrites an existing header spelled differently (one key only)', () => {
    document.cookie = 'csrf=tok; path=/'
    const m = mk('POST', '/a', { 'x-csrf': 'mine' })
    run(handler, m)
    expect(m.config.headers).toEqual({ 'x-csrf': 'mine' })
  })
  it('replaces an empty/null existing header with the token, under a single key', () => {
    document.cookie = 'csrf=tok; path=/'
    const m = mk('POST', '/a', { 'x-csrf': null })
    run(handler, m)
    expect(m.config.headers).toEqual({ 'X-CSRF': 'tok' })
  })
  it('sends the token for POST/PUT/PATCH/DELETE same-origin, not for GET', () => {
    document.cookie = 'csrf=tok; path=/'
    for (const type of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
      const m = mk(type, '/a')
      run(handler, m)
      expect(m.config.headers['X-CSRF']).toBe('tok')
    }
    const g = mk('GET', '/a')
    run(handler, g)
    expect(g.config.headers['X-CSRF']).toBeUndefined()
  })
  it('does nothing without a cookie', () => {
    const m = mk('POST', '/a')
    run(handler, m)
    expect(m.config.headers).toEqual({})
  })
  it('does not send the token cross-origin, nor to ambiguous urls', () => {
    document.cookie = 'csrf=tok; path=/'
    const urls: Array<[string, string?]> = [
      ['https://evil.example.com/a'],
      ['/a', 'https://evil.example.com'],
      ['/\t/evil.com'],
      ['\\\\evil.com'],
      ['//evil.com'],
    ]
    for (const [url, base] of urls) {
      const m = mk('POST', url, {}, base)
      run(handler, m)
      expect(m.config.headers['X-CSRF'], url).toBeUndefined()
    }
  })
  it('falls back to options.baseURL when the method has none', () => {
    document.cookie = 'csrf=tok; path=/'
    const m = mk('POST', '/a')
    run(handler, m, { baseURL: 'https://evil.example.com' })
    expect(m.config.headers['X-CSRF']).toBeUndefined()
  })
  it('uses csrftoken / X-CSRFToken by default', () => {
    document.cookie = 'csrftoken=D; path=/'
    const m = mk('POST', '/x')
    run(csrfHandler(), m)
    expect(m.config.headers).toEqual({ 'X-CSRFToken': 'D' })
  })
  it('does nothing without a document', () => {
    document.cookie = 'csrf=tok; path=/'
    const realDocument = globalThis.document
    // @ts-expect-error simulate SSR
    delete globalThis.document
    try {
      const m = mk('POST', '/a')
      run(handler, m)
      expect(m.config.headers).toEqual({})
    } finally {
      globalThis.document = realDocument
    }
  })
})
