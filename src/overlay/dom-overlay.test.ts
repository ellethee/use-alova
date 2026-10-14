import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OVERLAY_STYLE_ID, domOverlay } from './dom-overlay'
import * as overlayModule from './index'

const overlayEls = () => document.querySelectorAll('#use-alova-overlay')
const styles = () => document.querySelectorAll(`style#${OVERLAY_STYLE_ID}`)

beforeEach(() => {
  styles().forEach(n => n.remove())
})
afterEach(() => {
  overlayEls().forEach(n => n.remove())
  styles().forEach(n => n.remove())
})

describe('domOverlay', () => {
  it('returns the overlay adapter with the given mode and delay', () => {
    expect(domOverlay({ mode: 'auto', delay: 150 })).toMatchObject({ mode: 'auto', delay: 150 })
    expect(domOverlay().show).toBeTypeOf('function')
    expect(domOverlay().hide).toBeTypeOf('function')
  })
  it('show appends the overlay with the default spinner, hide removes it', () => {
    const { show, hide } = domOverlay()
    show!()
    expect(overlayEls()).toHaveLength(1)
    expect(document.querySelector('#use-alova-overlay .use-alova-spinner')).not.toBeNull()
    expect(overlayEls()[0]!.getAttribute('role')).toBe('status')
    hide!()
    expect(overlayEls()).toHaveLength(0)
  })
  it('show and hide are idempotent', () => {
    const { show, hide } = domOverlay()
    show!()
    show!()
    expect(overlayEls()).toHaveLength(1)
    hide!()
    hide!()
    expect(overlayEls()).toHaveLength(0)
    show!()
    expect(overlayEls()).toHaveLength(1)
  })
  it('uses a custom spinner node', () => {
    const { show } = domOverlay({
      spinner: () => Object.assign(document.createElement('b'), { textContent: 'wait' }),
    })
    show!()
    expect(overlayEls()[0]!.textContent).toBe('wait')
    expect(document.querySelector('.use-alova-spinner')).toBeNull()
  })
  it('injects the styles once, at runtime', () => {
    const { show, hide } = domOverlay()
    expect(styles()).toHaveLength(0)
    show!()
    hide!()
    show!()
    expect(styles()).toHaveLength(1)
    expect(styles()[0]!.textContent).toContain('#use-alova-overlay')
    expect(styles()[0]!.textContent).toContain('.use-alova-spinner')
    expect(styles()[0]!.textContent).not.toContain('cursor')
    expect(OVERLAY_STYLE_ID).toBe('pachi-overlay-style')
  })
  it('is a no-op without a document', () => {
    const realDocument = globalThis.document
    // @ts-expect-error simulate SSR
    delete globalThis.document
    try {
      const { show, hide } = domOverlay()
      expect(() => {
        show!()
        hide!()
      }).not.toThrow()
    } finally {
      globalThis.document = realDocument
    }
  })
  it('the module exports only domOverlay', () => {
    expect(Object.keys(overlayModule)).toEqual(['domOverlay'])
  })
})
