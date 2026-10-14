import type { UseAlovaMethod, OverlayOptions } from './types'

/** Reference counting between the requests and the `show`/`hide` functions of the overlay adapter. */
export interface OverlayController {
  /** Registers a request that is about to be sent (idempotent per method). */
  acquire(method: UseAlovaMethod): void
  /** Releases the request registered by `acquire` (idempotent per method, a no-op for unknown methods). */
  release(method: UseAlovaMethod): void
}

/** Controller used when no `show`/`hide` is configured: it does nothing, not even counting. */
const NOOP_CONTROLLER: OverlayController = { acquire() {}, release() {} }

/**
 * Creates the controller that drives an overlay adapter.
 *
 * - `show()` is called when the first request that wants the overlay is sent (after `delay` ms, if the
 *   request is still pending), `hide()` when the last one ends: concurrent requests share one overlay.
 * - A request wants the overlay when its config has `showOverlay: true`, or, with `mode: 'auto'`, unless it
 *   has `showOverlay: false`.
 * - Each method holds at most one reference, so releasing it from several places (success and complete)
 *   counts once. A request that ends before `delay` never shows (nor hides) anything.
 * - An exception thrown by the adapter is logged and never breaks the request.
 *
 * @param options - The `overlay` option (nothing is shown without `show` and `hide`).
 * @returns The controller.
 */
export function createOverlayController(options: OverlayOptions | undefined): OverlayController {
  if (!options || (!options.show && !options.hide)) return NOOP_CONTROLLER
  const mode = options.mode ?? 'manual'
  const delay = Math.max(0, Number(options.delay) || 0)
  const active = new WeakSet<object>()
  let count = 0
  let shown = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const call = (fn: (() => void) | undefined, what: string): void => {
    try {
      fn?.()
    } catch (err) {
      console.error(`[use-alova] overlay ${what} failed`, err)
    }
  }
  const reveal = (): void => {
    timer = undefined
    if (count === 0 || shown) return
    shown = true
    call(options.show, 'show')
  }
  const wants = (method: UseAlovaMethod): boolean => {
    const flag = method.config.showOverlay
    return flag === true || (mode === 'auto' && flag !== false)
  }

  return {
    acquire(method) {
      if (active.has(method) || !wants(method)) return
      active.add(method)
      count++
      if (count > 1) return
      if (delay > 0) timer = setTimeout(reveal, delay)
      else reveal()
    },
    release(method) {
      if (!active.delete(method)) return
      count--
      if (count > 0) return
      clearTimeout(timer)
      timer = undefined
      if (shown) {
        shown = false
        call(options.hide, 'hide')
      }
    },
  }
}
