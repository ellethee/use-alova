import { describe, expect, it } from 'vitest'
import { findHeaderKey, mergeHeaders } from './headers'

describe('mergeHeaders', () => {
  it('merges case-insensitively, the later source wins and keeps its spelling', () => {
    const merged = mergeHeaders(
      { Authorization: 'Bearer D', 'X-A': '1' },
      { authorization: 'Bearer M' }
    )
    expect(merged).toEqual({ 'X-A': '1', authorization: 'Bearer M' })
  })
  it('skips undefined sources and does not mutate inputs', () => {
    const a = { A: '1' }
    expect(mergeHeaders(undefined, a, null, { a: '2' })).toEqual({ a: '2' })
    expect(a).toEqual({ A: '1' })
  })
})

describe('findHeaderKey', () => {
  it('finds a header ignoring case and returns the key as spelled', () => {
    expect(findHeaderKey({ 'Content-Type': 'a', 'X-A': '1' }, 'content-type')).toBe('Content-Type')
    expect(findHeaderKey({ authorization: 'a' }, 'AUTHORIZATION')).toBe('authorization')
  })
  it('returns undefined when absent or without headers', () => {
    expect(findHeaderKey({ 'X-A': '1' }, 'authorization')).toBeUndefined()
    expect(findHeaderKey(undefined, 'authorization')).toBeUndefined()
    expect(findHeaderKey(null, 'authorization')).toBeUndefined()
  })
})
