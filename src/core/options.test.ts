import { describe, expect, it } from 'vitest'
import { omitUndefined, withDefault } from './options'

describe('omitUndefined', () => {
  it('removes only undefined values', () => {
    expect(omitUndefined({ a: undefined, b: null, c: 0 })).toEqual({ b: null, c: 0 })
    expect(omitUndefined(undefined)).toEqual({})
  })
})

describe('withDefault', () => {
  it('undefined selects the default, null the opt-out value', () => {
    expect(withDefault(undefined, [1], [])).toEqual([1])
    expect(withDefault(null, [1], [])).toEqual([])
    expect(withDefault([2], [1], [])).toEqual([2])
  })
})
