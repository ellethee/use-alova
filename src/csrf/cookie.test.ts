import { afterEach, describe, expect, it } from 'vitest'
import { getCookie } from './cookie'

const clear = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

afterEach(() => {
  for (const name of ['my name', 'dup', 'xdup', 'bad', 'plain']) clear(name)
})

describe('getCookie', () => {
  it('decodes values', () => {
    document.cookie = `${encodeURIComponent('my name')}=${encodeURIComponent('a b;c=é')}; path=/`
    expect(getCookie('my name')).toBe('a b;c=é')
  })
  it('reads a plain cookie', () => {
    document.cookie = 'plain=1; path=/'
    expect(getCookie('plain')).toBe('1')
  })
  it('returns null when missing', () => {
    expect(getCookie('nope')).toBeNull()
  })
  it('takes the first occurrence and does not match suffixes', () => {
    document.cookie = 'dup=first; path=/'
    document.cookie = 'xdup=other; path=/'
    expect(getCookie('dup')).toBe('first')
  })
  it('returns the raw value when decoding fails', () => {
    document.cookie = 'bad=%E0%A4%A; path=/'
    expect(getCookie('bad')).toBe('%E0%A4%A')
  })
})
