import { notifyStyles } from './styles'

/** Icon/type of a notification: determines the color. */
export type NotifyIcon = 'success' | 'error' | 'warning' | 'info' | 'question'

/** Position of toasts on the screen. */
export type NotifyPosition = 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start'

/**
 * Options for toast and notification box.
 *
 * @property icon - Notification type (color). Default `'error'`.
 * @property title - Optional title.
 * @property text - Message text (always inserted as text, never as HTML).
 * @property timer - Toast only: milliseconds before auto-close. Default `3000`, `0` disables it.
 * @property position - Toast only: screen corner. Default `'top-end'`.
 * @property confirmButtonText - Box only: text of the close button. Default `'OK'`.
 */
export interface NotifyOptions {
  icon?: NotifyIcon
  title?: string
  text?: string
  timer?: number
  position?: NotifyPosition
  confirmButtonText?: string
}

const STYLE_ID = 'pachi-notify-style'
const DEFAULT_TIMER = 3000

/**
 * Inserts the notification styles into the `<head>`, only once.
 */
function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = notifyStyles
  document.head.appendChild(style)
}

/**
 * Creates an element with an optional class and text.
 *
 * @param tag - Tag name.
 * @param className - CSS class.
 * @param text - Text (inserted via `textContent`).
 * @returns The created element.
 */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * Returns (creating it if needed) the toast container for the requested position.
 *
 * @param position - Toast position.
 * @returns The container.
 */
function getToastContainer(position: NotifyPosition): HTMLElement {
  const cls = `pachi-toast-container pachi-${position}`
  let container = document.querySelector<HTMLElement>(`.${cls.split(' ').join('.')}`)
  if (!container) {
    container = el('div', cls)
    document.body.appendChild(container)
  }
  return container
}

/**
 * Shows a minimal toast, with auto-close (paused on mouse hover) and a close button.
 *
 * @param options - Notification options.
 */
export function showToast(options: NotifyOptions = {}): void {
  if (typeof document === 'undefined') return
  ensureStyles()
  const { icon = 'error', title, text, timer = DEFAULT_TIMER, position = 'top-end' } = options

  const container = getToastContainer(position)
  const toast = el('div', `pachi-toast pachi-${icon}`)
  toast.setAttribute('role', 'alert')
  const body = el('div', 'pachi-body')
  if (title) body.appendChild(el('div', 'pachi-title', title))
  if (text) body.appendChild(el('div', 'pachi-text', text))
  const close = el('button', 'pachi-close', '×')
  close.type = 'button'
  close.setAttribute('aria-label', 'Close')
  toast.append(body, close)
  container.appendChild(toast)

  let handle: ReturnType<typeof setTimeout> | undefined
  let remaining = timer
  let startedAt = 0
  const remove = () => {
    clearTimeout(handle)
    toast.remove()
    if (!container.children.length) container.remove()
  }
  const start = () => {
    if (remaining <= 0) return
    startedAt = Date.now()
    handle = setTimeout(remove, remaining)
  }
  const pause = () => {
    clearTimeout(handle)
    remaining -= Date.now() - startedAt
  }
  close.addEventListener('click', remove)
  toast.addEventListener('mouseenter', pause)
  toast.addEventListener('mouseleave', start)
  start()
}

/**
 * Shows a minimal modal box with a close button.
 * It closes via the button, with `Esc`, or by clicking the backdrop. If the box is removed from the DOM by
 * other code, the key listener removes itself (and the promise resolves) at the next key press.
 *
 * @param options - Notification options.
 * @returns A Promise that resolves when the box is closed.
 */
export function showBox(options: NotifyOptions = {}): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  ensureStyles()
  const { icon = 'error', title, text, confirmButtonText = 'OK' } = options

  return new Promise<void>(resolve => {
    const backdrop = el('div', 'pachi-backdrop')
    const box = el('div', `pachi-box pachi-${icon}`)
    box.setAttribute('role', 'alertdialog')
    box.setAttribute('aria-modal', 'true')
    if (title) box.appendChild(el('div', 'pachi-title', title))
    if (text) box.appendChild(el('div', 'pachi-text', text))
    const confirm = el('button', 'pachi-confirm', confirmButtonText)
    confirm.type = 'button'
    box.appendChild(confirm)
    backdrop.appendChild(box)

    const onKey = (e: KeyboardEvent) => {
      // The backdrop may have been detached from outside (e.g. `document.body` emptied): clean up on the next key.
      if (e.key === 'Escape' || !backdrop.isConnected) done()
    }
    const done = () => {
      document.removeEventListener('keydown', onKey)
      backdrop.remove()
      resolve()
    }
    confirm.addEventListener('click', done)
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) done()
    })
    document.addEventListener('keydown', onKey)
    document.body.appendChild(backdrop)
    confirm.focus()
  })
}

/**
 * Ready-to-use toast: `Toast.fire({ icon, title, text })`.
 */
export const Toast = { fire: showToast }

/**
 * Ready-to-use modal box: `Box.fire({ icon, title, text })`.
 */
export const Box = { fire: showBox }
