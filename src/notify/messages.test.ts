import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponseError } from '../core/response-error'
import { boxMessage, createBoxMessage, createToastMessage, toastMessage } from './messages'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  document.getElementById('pachi-notify-style')?.remove()
})

const err = (body: string, status = 500, statusText = '') =>
  new ResponseError(new Response(body, { status, statusText }))

describe('toastMessage', () => {
  it('shows "Error: <status> <body>" for a plain-text body', async () => {
    await toastMessage(err('nope'))
    expect(document.body.textContent).toContain('Error: 500 nope')
    expect(document.querySelector('.pachi-toast.pachi-error')).not.toBeNull()
  })
  it('shows only the status for an empty body without status text', async () => {
    await toastMessage(err(''))
    expect(document.body.textContent).toContain('Error: 500')
    expect(document.body.textContent).not.toContain('HTTP')
  })
  it('never shows an HTML body', async () => {
    await toastMessage(err('<html>SECRET-PAGE</html>', 502, 'Bad Gateway'))
    expect(document.body.textContent).toContain('Error: 502 Bad Gateway')
    expect(document.body.textContent).not.toContain('SECRET-PAGE')
  })
  it('shows network errors without a status', async () => {
    await toastMessage(new ResponseError(new Error('Failed to fetch')))
    expect(document.body.textContent).toContain('Error: Failed to fetch')
  })
  it('can be used as the messageFunction of a ResponseError', async () => {
    await new ResponseError(new Response('x', { status: 404 }), {
      messageFunction: toastMessage,
    }).showMessage()
    expect(document.body.textContent).toContain('Error: 404 x')
  })
})

describe('createToastMessage', () => {
  it('applies the options but always replaces the text', async () => {
    await createToastMessage({
      icon: 'warning',
      title: 'Oops',
      text: 'ignored',
      position: 'bottom-start',
    })(err('real'))
    expect(document.querySelector('.pachi-toast.pachi-warning')).not.toBeNull()
    expect(document.querySelector('.pachi-toast-container.pachi-bottom-start')).not.toBeNull()
    expect(document.querySelector('.pachi-title')?.textContent).toBe('Oops')
    expect(document.body.textContent).toContain('Error: 500 real')
    expect(document.body.textContent).not.toContain('ignored')
  })
})

describe('boxMessage', () => {
  it('shows a box titled "Error: <status>" with the message', async () => {
    const p = boxMessage(err('broken'))
    await vi.waitFor(() => expect(document.querySelector('.pachi-box')).not.toBeNull())
    expect(document.querySelector('.pachi-title')?.textContent).toBe('Error: 500')
    expect(document.querySelector('.pachi-text')?.textContent).toBe('broken')
    ;(document.querySelector('.pachi-confirm') as HTMLElement).click()
    await p
    expect(document.querySelector('.pachi-box')).toBeNull()
  })
  it('titles network errors "Error" and honours the options', async () => {
    const p = createBoxMessage({ confirmButtonText: 'Close', icon: 'info' })(
      new ResponseError(new Error('offline'))
    )
    await vi.waitFor(() => expect(document.querySelector('.pachi-box.pachi-info')).not.toBeNull())
    expect(document.querySelector('.pachi-title')?.textContent).toBe('Error')
    expect(document.querySelector('.pachi-confirm')?.textContent).toBe('Close')
    ;(document.querySelector('.pachi-confirm') as HTMLElement).click()
    await p
  })
})
