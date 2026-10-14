import { describe, expect, it } from 'vitest'
import { formDataToUrlSearchParams, toFormData, toUrlSearchParams } from './form'

describe('toUrlSearchParams', () => {
  it('skips null/undefined, expands arrays and stringifies objects', () => {
    const input = { a: 1, b: null, c: undefined, d: [1, 2], e: { x: 1 }, f: false }
    const params = toUrlSearchParams(input)
    expect(params.has('b')).toBe(false)
    expect(params.has('c')).toBe(false)
    expect(params.getAll('d')).toEqual(['1', '2'])
    expect(params.get('e')).toBe('{"x":1}')
    expect(params.get('f')).toBe('false')
    expect(input.d).toEqual([1, 2])
  })
})

describe('toFormData', () => {
  it('appends files with default field names and extra fields', () => {
    const f1 = new File(['a'], 'a.txt')
    const f2 = new File(['b'], 'b.txt')
    expect(toFormData(f1, {}).getAll('file')).toHaveLength(1)
    const fd = toFormData([f1, f2], {
      n: 1,
      skip: null,
      list: ['x', 'y'],
      o: { k: 1 },
      blob: new Blob(['z']),
    })
    expect(fd.getAll('files')).toHaveLength(2)
    expect(fd.has('skip')).toBe(false)
    expect(fd.getAll('list')).toEqual(['x', 'y'])
    expect(fd.get('o')).toBe('{"k":1}')
    expect(fd.get('blob')).toBeInstanceOf(Blob)
    expect(toFormData(f1, null, 'custom').has('custom')).toBe(true)
  })
})

describe('toFormData with unnamed blobs', () => {
  it('never produces the file name "undefined"', () => {
    const fd = toFormData(new Blob(['a']), {})
    expect((fd.get('file') as File).name).toBe('blob')
    const many = toFormData([new Blob(['a']), new File(['b'], 'b.txt')], {})
    expect(many.getAll('files').map(f => (f as File).name)).toEqual(['blob', 'b.txt'])
  })
})

describe('formDataToUrlSearchParams', () => {
  it('converts string entries keeping repeated keys', () => {
    const fd = new FormData()
    fd.append('a', '1')
    fd.append('d', 'x')
    fd.append('d', 'y')
    expect([...formDataToUrlSearchParams(fd).entries()]).toEqual([
      ['a', '1'],
      ['d', 'x'],
      ['d', 'y'],
    ])
  })
  it('throws a TypeError when an entry is a file', () => {
    const fd = new FormData()
    fd.append('f', new File(['x'], 'x.txt'))
    expect(() => formDataToUrlSearchParams(fd)).toThrow(TypeError)
    expect(() => formDataToUrlSearchParams(fd)).toThrow('use $upload')
  })
})
