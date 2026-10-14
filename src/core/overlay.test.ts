import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UseAlovaMethod } from './types'
import { createOverlayController } from './overlay'

const fakeMethod = (config: Record<string, unknown> = {}) =>
  ({ config }) as unknown as UseAlovaMethod

afterEach(() => {
  vi.useRealTimers()
})

/** Controller wired to spies. */
function setup(extra: { mode?: 'manual' | 'auto'; delay?: number } = {}) {
  const show = vi.fn()
  const hide = vi.fn()
  return { show, hide, controller: createOverlayController({ show, hide, ...extra }) }
}

describe('overlay controller: manual mode (default)', () => {
  it('shows only for requests with showOverlay: true', () => {
    const { controller, show, hide } = setup()
    const plain = fakeMethod()
    const off = fakeMethod({ showOverlay: false })
    controller.acquire(plain)
    controller.acquire(off)
    expect(show).not.toHaveBeenCalled()
    controller.release(plain)
    controller.release(off)
    expect(hide).not.toHaveBeenCalled()
    const on = fakeMethod({ showOverlay: true })
    controller.acquire(on)
    expect(show).toHaveBeenCalledOnce()
    controller.release(on)
    expect(hide).toHaveBeenCalledOnce()
  })

  it('is reference counted: show at the first request, hide at the last', () => {
    const { controller, show, hide } = setup()
    const a = fakeMethod({ showOverlay: true })
    const b = fakeMethod({ showOverlay: true })
    controller.acquire(a)
    controller.acquire(b)
    expect(show).toHaveBeenCalledTimes(1)
    controller.release(a)
    expect(hide).not.toHaveBeenCalled()
    controller.release(b)
    expect(hide).toHaveBeenCalledTimes(1)
  })

  it('releases once per method even if release is called several times', () => {
    const { controller, show, hide } = setup()
    const a = fakeMethod({ showOverlay: true })
    const b = fakeMethod({ showOverlay: true })
    controller.acquire(a)
    controller.acquire(a)
    controller.acquire(b)
    controller.release(a)
    controller.release(a)
    expect(hide).not.toHaveBeenCalled()
    controller.release(b)
    expect(hide).toHaveBeenCalledTimes(1)
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('can be shown again after hiding, and ignores unknown methods', () => {
    const { controller, show, hide } = setup()
    controller.release(fakeMethod({ showOverlay: true }))
    expect(hide).not.toHaveBeenCalled()
    for (let i = 0; i < 2; i++) {
      const m = fakeMethod({ showOverlay: true })
      controller.acquire(m)
      controller.release(m)
    }
    expect(show).toHaveBeenCalledTimes(2)
    expect(hide).toHaveBeenCalledTimes(2)
  })
})

describe('overlay controller: auto mode', () => {
  it('shows for every request except those with showOverlay: false', () => {
    const { controller, show, hide } = setup({ mode: 'auto' })
    const off = fakeMethod({ showOverlay: false })
    controller.acquire(off)
    expect(show).not.toHaveBeenCalled()
    const plain = fakeMethod()
    controller.acquire(plain)
    expect(show).toHaveBeenCalledOnce()
    controller.release(off)
    expect(hide).not.toHaveBeenCalled()
    controller.release(plain)
    expect(hide).toHaveBeenCalledOnce()
  })
  it('showOverlay: true behaves like the default in auto mode', () => {
    const { controller, show } = setup({ mode: 'auto' })
    controller.acquire(fakeMethod({ showOverlay: true }))
    expect(show).toHaveBeenCalledOnce()
  })
})

describe('overlay controller: delay', () => {
  it('a request that ends before the delay shows (and hides) nothing', () => {
    vi.useFakeTimers()
    const { controller, show, hide } = setup({ delay: 200 })
    const m = fakeMethod({ showOverlay: true })
    controller.acquire(m)
    vi.advanceTimersByTime(199)
    expect(show).not.toHaveBeenCalled()
    controller.release(m)
    vi.advanceTimersByTime(1000)
    expect(show).not.toHaveBeenCalled()
    expect(hide).not.toHaveBeenCalled()
  })
  it('shows after the delay and hides when the request ends', () => {
    vi.useFakeTimers()
    const { controller, show, hide } = setup({ delay: 200 })
    const m = fakeMethod({ showOverlay: true })
    controller.acquire(m)
    vi.advanceTimersByTime(200)
    expect(show).toHaveBeenCalledOnce()
    controller.release(m)
    expect(hide).toHaveBeenCalledOnce()
  })
  it('concurrent requests share the delay: the first one starts the clock, the last one hides', () => {
    vi.useFakeTimers()
    const { controller, show, hide } = setup({ delay: 200 })
    const a = fakeMethod({ showOverlay: true })
    const b = fakeMethod({ showOverlay: true })
    controller.acquire(a)
    vi.advanceTimersByTime(100)
    controller.acquire(b)
    vi.advanceTimersByTime(100)
    expect(show).toHaveBeenCalledTimes(1)
    controller.release(a)
    expect(hide).not.toHaveBeenCalled()
    controller.release(b)
    expect(hide).toHaveBeenCalledTimes(1)
  })
  it('a request shortly after a quiet period starts a new delay', () => {
    vi.useFakeTimers()
    const { controller, show } = setup({ delay: 100 })
    const a = fakeMethod({ showOverlay: true })
    controller.acquire(a)
    controller.release(a)
    const b = fakeMethod({ showOverlay: true })
    controller.acquire(b)
    vi.advanceTimersByTime(99)
    expect(show).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(show).toHaveBeenCalledTimes(1)
  })
  it('treats a negative or invalid delay as 0', () => {
    for (const delay of [-5, Number.NaN]) {
      const { controller, show } = setup({ delay })
      controller.acquire(fakeMethod({ showOverlay: true }))
      expect(show).toHaveBeenCalledOnce()
    }
  })
})

describe('overlay controller: robustness', () => {
  it('does nothing without show/hide', () => {
    for (const options of [undefined, {}, { mode: 'auto' as const }]) {
      const controller = createOverlayController(options)
      const m = fakeMethod({ showOverlay: true })
      expect(() => {
        controller.acquire(m)
        controller.release(m)
      }).not.toThrow()
    }
  })
  it('works with only show or only hide', () => {
    const show = vi.fn()
    const c = createOverlayController({ show })
    const m = fakeMethod({ showOverlay: true })
    c.acquire(m)
    c.release(m)
    expect(show).toHaveBeenCalledOnce()
  })
  it('logs adapter failures without breaking the request, and keeps counting', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const hide = vi.fn()
    const controller = createOverlayController({
      show: () => {
        throw new Error('boom')
      },
      hide,
    })
    const m = fakeMethod({ showOverlay: true })
    expect(() => controller.acquire(m)).not.toThrow()
    expect(() => controller.release(m)).not.toThrow()
    expect(hide).toHaveBeenCalledOnce()
    expect(err).toHaveBeenCalled()
    const failing = createOverlayController({
      show: () => undefined,
      hide: () => {
        throw new Error('boom2')
      },
    })
    failing.acquire(m)
    expect(() => failing.release(m)).not.toThrow()
    err.mockRestore()
  })
})
