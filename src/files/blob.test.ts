import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UseAlovaMethod } from '../core/types'
import { getBlob, parseContentDispositionFileName, sanitizeFileName, toBlob } from './blob'

const method = (fileName?: string, download = false) =>
  ({
    config: { fileName },
    meta: download ? { useAlovaDownload: true } : undefined,
  }) as unknown as UseAlovaMethod
const resp = (cd?: string) =>
  new Response('data', { headers: cd ? { 'content-disposition': cd } : {} })

afterEach(() => vi.restoreAllMocks())

describe('parseContentDispositionFileName', () => {
  it.each([
    ['attachment; filename="a b.pdf"', 'a b.pdf'],
    ['attachment; filename=a.pdf', 'a.pdf'],
    ['attachment; filename="a.pdf"; size=10', 'a.pdf'],
    ['attachment; filename=a.pdf; size=10', 'a.pdf'],
    ["attachment; filename*=UTF-8''caff%C3%A8.pdf", 'caffè.pdf'],
    ['attachment; filename="x.pdf"; filename*=UTF-8\'\'y%20z.pdf', 'y z.pdf'],
    ['attachment', null],
    ['attachment; name="filename=zz"; filename="ok.txt"', 'ok.txt'],
    ['attachment; name="filename=zz"', null],
    ['attachment; filename="a\\"b.txt"', 'a"b.txt'],
    ['attachment; filename="a;b.txt"; x=1', 'a;b.txt'],
    ["attachment; filename*=ISO-8859-1''caff%E8.pdf", 'caffè.pdf'],
    ["attachment; filename*=utf-8'it'a%20b.pdf", 'a b.pdf'],
    ["attachment; filename*=unknown-cs''a%20b.pdf", 'a%20b.pdf'],
    ['attachment; filename="x.pdf"; filename*=UTF-8\'\'', 'x.pdf'],
  ])('%s', (header, expected) => {
    expect(parseContentDispositionFileName(header)).toBe(expected)
  })
})

describe('parseContentDispositionFileName performance', () => {
  it('is linear on crafted headers (ReDoS)', () => {
    for (const header of [
      'filename*= '.repeat(20000),
      'filename="'.repeat(20000),
      'filename='.repeat(20000),
      'x; '.repeat(20000),
    ]) {
      const t = performance.now()
      parseContentDispositionFileName(header)
      expect(performance.now() - t).toBeLessThan(50)
    }
  })
  it('ignores everything beyond 4 KB', () => {
    expect(
      parseContentDispositionFileName(`attachment; ${'x'.repeat(5000)}; filename="late.txt"`)
    ).toBeNull()
  })
})

describe('sanitizeFileName', () => {
  it.each([
    ['../../x.txt', 'x.txt'],
    ['..\\..\\x.txt', 'x.txt'],
    ['a/b.pdf', 'b.pdf'],
    ['con:.txt', 'con.txt'],
    ['a*b?"<>|.txt', 'ab.txt'],
    ['  ..name.. ', 'name'],
    ['a\u0000b\n.txt', 'ab.txt'],
    ['..', 'file.pdf'],
    ['', 'file.pdf'],
    ['dir/', 'file.pdf'],
  ])('%j -> %j', (input, expected) => {
    expect(sanitizeFileName(input)).toBe(expected)
  })
  it('uses the given fallback and caps the length', () => {
    expect(sanitizeFileName('/', 'fb.txt')).toBe('fb.txt')
    expect(sanitizeFileName('a'.repeat(1000)).length).toBe(255)
  })
})

describe('getBlob sanitizes names', () => {
  it('header, filename* and the fileName option', () => {
    expect(getBlob(resp('attachment; filename="../../x.txt"'), method())?.fileName).toBe('x.txt')
    expect(getBlob(resp("attachment; filename*=UTF-8''..%2F..%2Fx"), method())?.fileName).toBe('x')
    expect(getBlob(resp('attachment; filename="a/b.pdf"'), method())?.fileName).toBe('b.pdf')
    expect(getBlob(resp('attachment; filename="con:.txt"'), method())?.fileName).toBe('con.txt')
    expect(getBlob(resp(), method('../../opt.pdf'))?.fileName).toBe('opt.pdf')
    expect(getBlob(resp('attachment; filename=".."'), method('opt.pdf'))?.fileName).toBe('opt.pdf')
    expect(getBlob(resp('attachment; filename=".."'), method('..'))?.fileName).toBe('file.pdf')
  })
})

describe('getBlob', () => {
  it('uses the header file name', () => {
    expect(getBlob(resp('attachment; filename="r.csv"'), method())?.fileName).toBe('r.csv')
  })
  it('falls back to the option or default when the name is unparsable', () => {
    expect(getBlob(resp('attachment'), method('opt.pdf'))?.fileName).toBe('opt.pdf')
    expect(getBlob(resp('attachment'), method())?.fileName).toBe('file.pdf')
  })
  it('without header: uses fileName option, otherwise null', async () => {
    const b = getBlob(resp(), method('opt.pdf'))
    expect(b?.fileName).toBe('opt.pdf')
    expect(await b?.data).toBeInstanceOf(Blob)
    expect(getBlob(resp(), method())).toBeNull()
  })
  it('requests marked by $download/$jdownload default to file.pdf without header and fileName', () => {
    expect(getBlob(resp(), method(undefined, true))?.fileName).toBe('file.pdf')
    expect(getBlob(resp(), method('opt.pdf', true))?.fileName).toBe('opt.pdf')
  })
})

describe('toBlob', () => {
  it('downloads and revokes the object URL', async () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.fn()
    document.addEventListener('click', click)
    await toBlob({ fileName: 'f.txt', data: Promise.resolve(new Blob(['x'])) })
    expect(create).toHaveBeenCalled()
    expect(click).toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:x')
    document.removeEventListener('click', click)
    vi.useRealTimers()
  })
  it('sanitizes the name given to the anchor', async () => {
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    let seen = ''
    const onClick = (e: Event): void => {
      seen = (e.target as HTMLAnchorElement).download
    }
    document.addEventListener('click', onClick)
    await toBlob({ fileName: '../../evil.txt', data: Promise.resolve(new Blob(['x'])) })
    document.removeEventListener('click', onClick)
    expect(seen).toBe('evil.txt')
  })
  it('rejects on missing data or failing promise', async () => {
    await expect(
      toBlob({ fileName: 'f', data: Promise.resolve(undefined as any) })
    ).rejects.toThrow()
    await expect(toBlob({ fileName: 'f', data: Promise.reject(new Error('x')) })).rejects.toThrow(
      'x'
    )
  })
})
