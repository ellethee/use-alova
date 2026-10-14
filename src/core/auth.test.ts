import { describe, expect, it, vi } from 'vitest'
import type { UseAlovaMethod, UseAlovaOptions } from './types'
import { defaultAuthHandler, isAuthTarget } from './auth'

const mk = (type: string, url: string, headers: Record<string, any> = {}, baseURL?: string) =>
  ({ type, url, baseURL, config: { headers } }) as unknown as UseAlovaMethod

const options: UseAlovaOptions = { token: 'T' }

describe('defaultAuthHandler', () => {
  it('sets the header when absent', async () => {
    const m = mk('GET', '/a')
    await defaultAuthHandler(m, options)
    expect(m.config.headers.Authorization).toBe('Bearer T')
  })
  it('does not overwrite an existing header', async () => {
    const m = mk('GET', '/a', { Authorization: 'Basic x' })
    await defaultAuthHandler(m, options)
    expect(m.config.headers.Authorization).toBe('Basic x')
  })
  it('does not overwrite an existing header spelled differently', async () => {
    const m = mk('GET', '/a', { authorization: 'Basic x' })
    await defaultAuthHandler(m, options)
    expect(m.config.headers).toEqual({ authorization: 'Basic x' })
  })
  it('removes null/empty without a token', async () => {
    const m = mk('GET', '/a', { Authorization: null })
    await defaultAuthHandler(m, { ...options, token: undefined })
    expect('Authorization' in m.config.headers).toBe(false)
  })
  it('reads the token from a function, with a custom scheme', async () => {
    const m = mk('GET', '/a')
    await defaultAuthHandler(m, { token: () => 'F', authType: 'Token' })
    expect(m.config.headers.Authorization).toBe('Token F')
  })
  it('awaits an asynchronous token function and passes it the method', async () => {
    const m = mk('GET', '/a')
    const token = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 5))
      return 'A'
    })
    await defaultAuthHandler(m, { token })
    expect(m.config.headers.Authorization).toBe('Bearer A')
    expect(token).toHaveBeenCalledWith(m)
  })
  it('sends nothing for an empty or missing token, and does not even call the function for foreign hosts', async () => {
    for (const token of ['', () => '', () => null, async () => undefined, undefined]) {
      const m = mk('GET', '/a')
      await defaultAuthHandler(m, { token })
      expect(m.config.headers.Authorization).toBeUndefined()
    }
    const token = vi.fn(() => 'T')
    await defaultAuthHandler(mk('GET', 'https://evil.example.com/a'), { token })
    expect(token).not.toHaveBeenCalled()
  })
})

describe('defaultAuthHandler: authType', () => {
  it('accepts a function of the method; undefined and empty strings mean Bearer', async () => {
    const m = mk('GET', '/a')
    const authType = vi.fn(() => 'bearer')
    await defaultAuthHandler(m, { token: 'T', authType })
    expect(m.config.headers.Authorization).toBe('bearer T')
    expect(authType).toHaveBeenCalledWith(m)
    for (const value of [undefined, '']) {
      const n = mk('GET', '/a')
      await defaultAuthHandler(n, { token: 'T', authType: () => value })
      expect(n.config.headers.Authorization).toBe('Bearer T')
    }
  })
  it('does not call the function when no token is sent', async () => {
    const authType = vi.fn(() => 'x')
    await defaultAuthHandler(mk('GET', '/a'), { authType })
    await defaultAuthHandler(mk('GET', 'https://evil.example.com/a'), { token: 'T', authType })
    expect(authType).not.toHaveBeenCalled()
  })
})

describe('defaultAuthHandler origins', () => {
  it('does not send the token to third-party absolute urls (absolute, protocol-relative)', async () => {
    for (const m of [mk('GET', 'https://evil.example.com/a'), mk('GET', '//evil.example.com/a')]) {
      await defaultAuthHandler(m, options)
      expect(m.config.headers.Authorization).toBeUndefined()
    }
  })
  it('trusts the configured baseURL, even on another origin, for relative urls', async () => {
    const m = mk('GET', '/a', {}, 'https://api.other-origin.example.com/v1')
    await defaultAuthHandler(m, options)
    expect(m.config.headers.Authorization).toBe('Bearer T')
  })
  it('sends the token to the same origin, also absolute', async () => {
    const m = mk('GET', `${location.origin}/a`)
    await defaultAuthHandler(m, options)
    expect(m.config.headers.Authorization).toBe('Bearer T')
  })
  it('sends the token to origins in authOrigins only', async () => {
    const o = { ...options, authOrigins: ['https://api.example.com'] }
    const ok = mk('GET', '/a', {}, 'https://api.example.com/v1')
    await defaultAuthHandler(ok, o)
    expect(ok.config.headers.Authorization).toBe('Bearer T')
    const ok2 = mk('GET', 'https://api.example.com/a')
    await defaultAuthHandler(ok2, o)
    expect(ok2.config.headers.Authorization).toBe('Bearer T')
    const no = mk('GET', 'https://evil.example.com/a')
    await defaultAuthHandler(no, o)
    expect(no.config.headers.Authorization).toBeUndefined()
  })
  it('ignores a malformed authOrigins entry', async () => {
    expect(isAuthTarget(mk('GET', 'https://x.example.com/a'), { authOrigins: ['not a url'] })).toBe(
      false
    )
  })
})

describe('ambiguous urls (backslashes, control characters) are never trusted', () => {
  const vectors = [
    '\\\\evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/\n/evil.com',
    '\t//evil.com',
    ' //evil.com',
    '/\r/evil.com',
    '\\/evil.com',
  ]
  const bases: Array<string | undefined> = [undefined, '', '/']

  it.each(vectors)('no token for %j', async url => {
    for (const base of bases) {
      const m = mk('GET', url, {}, base)
      await defaultAuthHandler(m, options)
      expect(m.config.headers.Authorization).toBeUndefined()
    }
  })
  it('an unsafe baseURL is not trusted either', async () => {
    const m = mk('GET', '/a', {}, '\\\\evil.com')
    await defaultAuthHandler(m, options)
    expect(m.config.headers.Authorization).toBeUndefined()
  })
  it('base "/" does not make "//host" relative', async () => {
    const m = mk('GET', '//evil.com/a', {}, '/')
    await defaultAuthHandler(m, options)
    expect(m.config.headers.Authorization).toBeUndefined()
  })
  it('keeps trusting ordinary relative urls, ports, scheme case', async () => {
    for (const [url, base] of [
      ['/a', undefined],
      ['a/b', '/api'],
      ['/a', 'https://api.example.com/v1'],
      ['localhost:3000/x', undefined],
    ] as const) {
      const m = mk('GET', url, {}, base)
      await defaultAuthHandler(m, options)
      expect(m.config.headers.Authorization).toBe('Bearer T')
    }
  })
  it('rejects userinfo tricks as foreign hosts', async () => {
    const m = mk('GET', 'http://a@evil.example.com/')
    await defaultAuthHandler(m, options)
    expect(m.config.headers.Authorization).toBeUndefined()
  })
})
