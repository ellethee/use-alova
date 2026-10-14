import { describe, expect, it } from 'vitest'
import type { UseAlovaMethod } from './types'
import { ensureRawBodyContentType, getRawBodyContentType } from './body'

const fakeMethod = (data: unknown, headers: Record<string, any> = {}) =>
  ({ data, config: { headers } }) as unknown as UseAlovaMethod

describe('getRawBodyContentType', () => {
  it('maps raw body types', () => {
    expect(getRawBodyContentType(new URLSearchParams('a=1'))).toBe(
      'application/x-www-form-urlencoded;charset=UTF-8'
    )
    expect(getRawBodyContentType(new Blob(['x'], { type: 'text/plain' }))).toBe('text/plain')
    expect(getRawBodyContentType(new Blob(['x']))).toBe('application/octet-stream')
    expect(getRawBodyContentType(new ArrayBuffer(2))).toBe('application/octet-stream')
    expect(getRawBodyContentType(new ReadableStream())).toBe('application/octet-stream')
  })

  it('ignores JSON-serialized and other bodies', () => {
    for (const data of [{ a: 1 }, [1], 'text', null, undefined, new FormData()]) {
      expect(getRawBodyContentType(data)).toBeUndefined()
    }
  })
})

describe('ensureRawBodyContentType', () => {
  it('sets Content-Type for URLSearchParams, keeping other headers', () => {
    const m = fakeMethod(new URLSearchParams('a=1'), { 'X-A': '1' })
    ensureRawBodyContentType(m)
    expect(m.config.headers).toEqual({
      'X-A': '1',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    })
  })

  it('does not override an existing Content-Type (any case)', () => {
    const m = fakeMethod(new URLSearchParams('a=1'), { 'content-type': 'text/custom' })
    ensureRawBodyContentType(m)
    expect(m.config.headers).toEqual({ 'content-type': 'text/custom' })
  })

  it('replaces an empty Content-Type', () => {
    const m = fakeMethod(new Blob(['x'], { type: 'image/png' }), { 'Content-Type': null })
    ensureRawBodyContentType(m)
    expect(m.config.headers['Content-Type']).toBe('image/png')
  })

  it('leaves JSON bodies and FormData untouched', () => {
    for (const data of [{ a: 1 }, 'raw', new FormData()]) {
      const m = fakeMethod(data)
      ensureRawBodyContentType(m)
      expect(m.config.headers).toEqual({})
    }
  })
})
