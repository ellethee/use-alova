import { describe, expect, it } from 'vitest'
import type { UseAlovaMethod } from './types'
import { STOP_PROCESSOR, createProcessorHandler, parseCodeKey } from './pipeline'

const method = { config: {}, type: 'GET', url: '/x' } as unknown as UseAlovaMethod
const options: any = {}
const resp = (status: number) => new Response('', { status })

describe('parseCodeKey', () => {
  it('parses single codes, lists and ranges', () => {
    expect(parseCodeKey('404')).toEqual([404])
    expect(parseCodeKey('200,404')).toEqual([200, 404])
    expect(parseCodeKey('4xx')).toHaveLength(100)
    expect(parseCodeKey('4xx')[0]).toBe(400)
  })
  it('handles mixed lists', () => {
    const codes = parseCodeKey('2xx,404')
    expect(codes).toHaveLength(101)
    expect(codes).toContain(299)
    expect(codes).toContain(404)
  })
  it('ignores invalid items without NaN', () => {
    expect(parseCodeKey('200,OK')).toEqual([200])
    expect(parseCodeKey('abc' as any)).toEqual([])
  })
})

describe('createProcessorHandler', () => {
  it('accumulates results and skips undefined', async () => {
    const run = createProcessorHandler([() => 1, () => undefined, ({ result }) => result + 1])
    expect(await run({ options, method })).toBe(2)
  })
  it('stops with STOP_PROCESSOR keeping the last result', async () => {
    const run = createProcessorHandler([() => 'a', () => STOP_PROCESSOR, () => 'b'])
    expect(await run({ options, method })).toBe('a')
  })
  it('stops with a literal STOP_PROCESSOR entry', async () => {
    const run = createProcessorHandler([() => 'a', STOP_PROCESSOR, () => 'b'])
    expect(await run({ options, method })).toBe('a')
  })
  it('stops with the [value, STOP_PROCESSOR] tuple', async () => {
    const run = createProcessorHandler([() => ['v', STOP_PROCESSOR], () => 'b'])
    expect(await run({ options, method })).toBe('v')
  })
  it('runs map entries matching the status only', async () => {
    const run = createProcessorHandler([{ '4xx': () => 'client', 500: () => 'server' } as any])
    expect(await run({ options, method, response: resp(404) })).toBe('client')
    expect(await run({ options, method, response: resp(500) })).toBe('server')
    expect(await run({ options, method, response: resp(200) })).toBeNull()
  })
  it('ignores null entries', async () => {
    const run = createProcessorHandler([null as any, () => 1])
    expect(await run({ options, method, response: resp(200) })).toBe(1)
  })
})

describe('createProcessorHandler: retry context', () => {
  it('passes retry/retried through, and defaults to an unavailable retry', async () => {
    const seen: any[] = []
    await createProcessorHandler([
      c => {
        seen.push(c.retried, typeof c.retry)
      },
    ])({ options, method })
    expect(seen).toEqual([false, 'function'])
    const retry = () => Promise.resolve('again')
    await createProcessorHandler([
      c => {
        seen.push(c.retried, c.retry === retry)
      },
    ])({ options, method, retry, retried: true })
    expect(seen.slice(2)).toEqual([true, true])
    await expect(createProcessorHandler([c => c.retry()])({ options, method })).rejects.toThrow(
      'not available'
    )
  })
})
