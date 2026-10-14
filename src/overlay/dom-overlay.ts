import type { OverlayOptions } from '../core/types'
import { overlayStyles } from './styles'

/** `id` of the `<style>` element holding the overlay styles. */
export const OVERLAY_STYLE_ID = 'pachi-overlay-style'
/** `id` of the overlay element. */
export const OVERLAY_ELEMENT_ID = 'use-alova-overlay'

/**
 * Options of {@link domOverlay}.
 *
 * @property mode - `'manual'` (default) or `'auto'`, see `OverlayOptions`.
 * @property delay - Milliseconds before the overlay appears (default `0`), see `OverlayOptions`.
 * @property spinner - Function that creates the node shown in the middle of the overlay (called at every
 *   `show`). Default: a CSS spinner.
 */
export interface DomOverlayOptions {
  mode?: 'manual' | 'auto'
  delay?: number
  spinner?: () => Node
}

/**
 * Inserts the overlay stylesheet into the `<head>` once (idempotent, no-op without a DOM).
 * Importing `@ilpachi/use-alova/styles` as well is harmless: the rules are identical.
 */
export function ensureOverlayStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(OVERLAY_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = OVERLAY_STYLE_ID
  style.textContent = overlayStyles
  document.head.appendChild(style)
}

/**
 * Creates the default spinner element.
 *
 * @returns A `div.use-alova-spinner`.
 */
function defaultSpinner(): Node {
  const spinner = document.createElement('div')
  spinner.className = 'use-alova-spinner'
  return spinner
}

/**
 * Creates the `overlay` option backed by a dependency-free full-page DOM overlay
 * (`<div id="use-alova-overlay">` with a spinner, appended to `document.body`).
 *
 * The requests are counted by the core (one overlay for concurrent requests); `show` and `hide` are also
 * idempotent and are no-ops without a `document` (SSR). The styles are injected at runtime, once.
 *
 * @param options - Mode, delay and spinner.
 * @returns The value for `createUseAlova({ overlay })`.
 *
 * @example
 * ```ts
 * import { domOverlay } from '@ilpachi/use-alova/overlay'
 *
 * createUseAlova({ overlay: domOverlay({ mode: 'auto', delay: 200 }) })
 * ```
 */
export function domOverlay(options: DomOverlayOptions = {}): OverlayOptions {
  let element: HTMLElement | null = null
  const { mode, delay, spinner = defaultSpinner } = options
  return {
    mode,
    delay,
    show() {
      if (typeof document === 'undefined' || element) return
      ensureOverlayStyles()
      const container = document.createElement('div')
      container.id = OVERLAY_ELEMENT_ID
      container.className = OVERLAY_ELEMENT_ID
      container.setAttribute('role', 'status')
      container.setAttribute('aria-busy', 'true')
      container.appendChild(spinner())
      document.body.appendChild(container)
      element = container
    },
    hide() {
      element?.remove()
      element = null
    },
  }
}
