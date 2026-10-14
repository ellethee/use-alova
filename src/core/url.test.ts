import { describe, expect, it } from 'vitest'
import { completeUrl, isAbsoluteUrl, isSameOrigin, joinUrl } from './url'

describe('joinUrl', () => {
  it('joins relative base and path with exactly one slash', () => {
    expect(joinUrl('/api', 'users')).toBe('/api/users')
    expect(joinUrl('/api/', '/users')).toBe('/api/users')
    expect(joinUrl('/api//', '/users')).toBe('/api/users')
  })
  it('keeps the base path of absolute bases', () => {
    expect(joinUrl('https://x.org/api/v1', '/users')).toBe('https://x.org/api/v1/users')
  })
  it('returns the other part when one is empty', () => {
    expect(joinUrl('/api', undefined)).toBe('/api')
    expect(joinUrl('/api', '')).toBe('/api')
    expect(joinUrl(undefined, 'users')).toBe('users')
    expect(joinUrl('', undefined)).toBe('')
  })
  it('keeps absolute urls as they are', () => {
    expect(joinUrl('/api', 'http://other.org/a')).toBe('http://other.org/a')
    expect(joinUrl('/api', '//cdn.org/a')).toBe('//cdn.org/a')
  })
})

describe('isAbsoluteUrl', () => {
  it('detects absolute urls', () => {
    expect(isAbsoluteUrl('https://a.b')).toBe(true)
    expect(isAbsoluteUrl('/a/b')).toBe(false)
    expect(isAbsoluteUrl('a/b')).toBe(false)
  })
})

describe('isSameOrigin', () => {
  it('variants', () => {
    expect(isSameOrigin('/a')).toBe(true)
    expect(isSameOrigin('a/b', '/api')).toBe(true)
    expect(isSameOrigin(`${location.origin}/a`)).toBe(true)
    expect(isSameOrigin('//other.example.com/a')).toBe(false)
    expect(isSameOrigin('https://other.example.com/a')).toBe(false)
  })
  it('does not treat localhost:3000/x or foo:bar as hosts', () => {
    expect(isSameOrigin('localhost:3000/x')).toBe(true)
    expect(isSameOrigin('foo:bar')).toBe(true)
    expect(isSameOrigin('x', 'localhost:3000/api')).toBe(true)
  })
  it('ambiguous urls are never same-origin', () => {
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
    for (const url of vectors)
      for (const base of [undefined, '', '/']) expect(isSameOrigin(url, base), url).toBe(false)
  })
  it('scheme case does not matter; userinfo tricks are foreign; javascript: has no host', () => {
    expect(isSameOrigin(`${location.origin.replace(/^http/, 'HTTP')}/a`)).toBe(true)
    expect(isSameOrigin('http://localhost@evil.example.com/')).toBe(false)
    expect(isSameOrigin(`${location.origin}@evil.example.com/`)).toBe(false)
    expect(isSameOrigin('javascript:alert(1)')).toBe(true)
  })
})

describe('completeUrl', () => {
  it('builds the final url like alova', () => {
    expect(completeUrl('/a', '/api')).toBe('/api/a')
    expect(completeUrl('a', '/api/')).toBe('/api/a')
    expect(completeUrl('', '/api')).toBe('/api')
    expect(completeUrl('https://x.org/a', '/api')).toBe('https://x.org/a')
    expect(completeUrl('//x.org/a', '/api')).toBe('/api//x.org/a')
  })
})
