import { describe, expect, it, vi } from 'vitest'
import { ResponseError } from './response-error'

describe('ResponseError', () => {
  it('wraps a Response', async () => {
    const e = new ResponseError(new Response('{"a":1}', { status: 400, statusText: 'Bad' }))
    expect(e.status).toBe(400)
    expect(e.statusText).toBe('Bad')
    expect(e.message).toBe('Bad')
    expect(e.isAbort).toBe(false)
    expect(await e.safeResponseData()).toEqual({ a: 1 })
  })
  it('wraps a network error keeping cause, message and stack', () => {
    const err = new TypeError('Failed to fetch')
    const e = new ResponseError(err)
    expect(e.response).toBeUndefined()
    expect(e.cause).toBe(err)
    expect(e.status).toBe(0)
    expect(e.statusText).toBe('Failed to fetch')
    expect(e.message).toBe('Failed to fetch')
    expect(e.stack).toBe(err.stack)
    expect(e.isAbort).toBe(false)
  })
  it('detects aborts and never shows them', async () => {
    const fn = vi.fn()
    const e = new ResponseError(new DOMException('aborted', 'AbortError'), { messageFunction: fn })
    expect(e.isAbort).toBe(true)
    await e.showMessage()
    expect(fn).not.toHaveBeenCalled()
  })
  it('showMessage does nothing without a (valid) messageFunction', async () => {
    for (const messageFunction of [null, undefined, 42 as any]) {
      const e = new ResponseError(new Response('nope', { status: 500 }), { messageFunction })
      expect(e.messageFunction).toBeUndefined()
      await expect(e.showMessage()).resolves.toBeUndefined()
    }
    expect(document.body.textContent).toBe('')
  })
  it('shows network errors', async () => {
    const fn = vi.fn()
    await new ResponseError(new Error('x'), { messageFunction: fn }).showMessage()
    expect(fn).toHaveBeenCalledOnce()
  })
  it('allows reading the body multiple times', async () => {
    const e = new ResponseError(new Response('{"a":1}', { status: 500, statusText: 'ISE' }), {
      messageFunction: async err => {
        await err.safeResponseText()
      },
    })
    await e.showMessage()
    expect(await e.safeResponseJson()).toEqual({ a: 1 })
    expect(await e.safeResponseText()).toBe('{"a":1}')
    expect(await e.response!.text()).toBe('{"a":1}')
  })
  it('safeResponseData falls back to text and null', async () => {
    expect(await new ResponseError(new Response('plain', { status: 500 })).safeResponseData()).toBe(
      'plain'
    )
    expect(await new ResponseError(new Error('x')).safeResponseData()).toBeNull()
  })

  describe('display message', () => {
    const msg = (res: Response) => new ResponseError(res).getDisplayMessage()
    it('uses a short plain-text body', async () => {
      expect(await msg(new Response('Not allowed', { status: 403, statusText: 'Forbidden' }))).toBe(
        'Not allowed'
      )
    })
    it('truncates long bodies to 200 characters', async () => {
      const text = await msg(new Response('a'.repeat(500), { status: 500, statusText: 'ISE' }))
      expect(text.length).toBeLessThanOrEqual(201)
      expect(text.startsWith('a'.repeat(200))).toBe(true)
    })
    it('never shows an HTML body: statusText, then HTTP <status>', async () => {
      expect(
        await msg(
          new Response('<html><body>Oops</body></html>', { status: 502, statusText: 'Bad Gateway' })
        )
      ).toBe('Bad Gateway')
      expect(await msg(new Response('<html></html>', { status: 502 }))).toBe('HTTP 502')
    })
    it('empty body: statusText, or HTTP <status> for an empty (HTTP/2) statusText', async () => {
      expect(await msg(new Response(null, { status: 404, statusText: 'Not Found' }))).toBe(
        'Not Found'
      )
      expect(await msg(new Response(null, { status: 404 }))).toBe('HTTP 404')
      expect(new ResponseError(new Response(null, { status: 404 })).message).toBe('HTTP 404')
    })
  })
})
