import { describe, expect, it } from 'vitest'
import { STOP_PROCESSOR } from '../core/pipeline'
import type { UseAlovaMethod } from '../core/types'
import { blobHandler, domHandler, fileSuccessHandlers } from './handlers'
import { defaultJsonHandler } from '../core/handlers'

const method = { config: {}, meta: {} } as unknown as UseAlovaMethod

describe('blobHandler', () => {
  it('returns [blob, STOP_PROCESSOR] for Content-Disposition', async () => {
    const response = new Response('x', {
      headers: { 'content-disposition': 'attachment; filename="a.txt"' },
    })
    const r = (await blobHandler({ response, method } as any)) as any[]
    expect(r[0].fileName).toBe('a.txt')
    expect(r[1]).toBe(STOP_PROCESSOR)
  })
  it('is undefined for ordinary responses and null without a response', async () => {
    expect(await blobHandler({ response: new Response('x'), method } as any)).toBeUndefined()
    expect(await blobHandler({ method } as any)).toBeNull()
  })
})

describe('domHandler', () => {
  it('returns [Document, STOP_PROCESSOR] for html, undefined otherwise', async () => {
    const html = new Response('<h1>x</h1>', { headers: { 'content-type': 'text/html' } })
    const r = (await domHandler({ response: html } as any)) as any[]
    expect(r[0].querySelector('h1')).not.toBeNull()
    expect(r[1]).toBe(STOP_PROCESSOR)
    expect(await domHandler({ response: new Response('{}') } as any)).toBeUndefined()
    expect(await domHandler({} as any)).toBeNull()
  })
})

describe('fileSuccessHandlers', () => {
  it('is the frozen 1.x default: blob, dom, json', () => {
    expect(fileSuccessHandlers).toHaveLength(3)
    expect(fileSuccessHandlers[2]).toBe(defaultJsonHandler)
    expect(Object.isFrozen(fileSuccessHandlers)).toBe(true)
  })
})
