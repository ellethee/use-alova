import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Box, Toast, showBox, showToast } from './notify'
import { notifyStyles } from './styles'

const toasts = () => document.querySelectorAll('.pachi-toast')

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  document.getElementById('pachi-notify-style')?.remove()
})

describe('showToast', () => {
  it('renders title and text, injects styles once', () => {
    showToast({ title: 'T', text: 'msg' })
    showToast({ text: 'second' })
    expect(toasts()).toHaveLength(2)
    expect(document.querySelector('.pachi-title')?.textContent).toBe('T')
    expect(document.querySelectorAll('#pachi-notify-style')).toHaveLength(1)
    expect(document.querySelector('.pachi-toast')?.getAttribute('role')).toBe('alert')
  })

  it('applies default icon and position', () => {
    showToast({ text: 'x' })
    expect(document.querySelector('.pachi-toast.pachi-error')).not.toBeNull()
    expect(document.querySelector('.pachi-toast-container.pachi-top-end')).not.toBeNull()
  })

  it('uses a separate container per position', () => {
    showToast({ text: 'a', position: 'bottom-start' })
    showToast({ text: 'b', position: 'top-start' })
    expect(document.querySelectorAll('.pachi-toast-container')).toHaveLength(2)
  })

  it('never interprets text as HTML', () => {
    showToast({ title: '<b>t</b>', text: '<img src=x onerror=alert(1)>' })
    expect(document.querySelector('.pachi-toast img')).toBeNull()
    expect(document.querySelector('.pachi-toast b')).toBeNull()
  })

  it('auto-closes after the timer and removes empty container', () => {
    showToast({ text: 'x', timer: 1000 })
    vi.advanceTimersByTime(999)
    expect(toasts()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts()).toHaveLength(0)
    expect(document.querySelector('.pachi-toast-container')).toBeNull()
  })

  it('timer 0 disables auto-close', () => {
    showToast({ text: 'x', timer: 0 })
    vi.advanceTimersByTime(60000)
    expect(toasts()).toHaveLength(1)
  })

  it('closes with the close button', () => {
    showToast({ text: 'x', timer: 0 })
    document.querySelector<HTMLButtonElement>('.pachi-close')!.click()
    expect(toasts()).toHaveLength(0)
  })

  it('pauses on hover and resumes with the remaining time', () => {
    showToast({ text: 'x', timer: 1000 })
    const toast = document.querySelector('.pachi-toast')!
    vi.advanceTimersByTime(400)
    toast.dispatchEvent(new Event('mouseenter'))
    vi.advanceTimersByTime(5000)
    expect(toasts()).toHaveLength(1)
    toast.dispatchEvent(new Event('mouseleave'))
    vi.advanceTimersByTime(599)
    expect(toasts()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(toasts()).toHaveLength(0)
  })

  it('Toast.fire is showToast', () => {
    Toast.fire({ text: 'x' })
    expect(toasts()).toHaveLength(1)
  })
})

describe('showBox', () => {
  const backdrop = () => document.querySelector('.pachi-backdrop')

  it('renders a modal with default button text and focuses it', () => {
    void showBox({ title: 'T', text: 'msg' })
    const confirm = document.querySelector<HTMLButtonElement>('.pachi-confirm')!
    expect(confirm.textContent).toBe('OK')
    expect(document.activeElement).toBe(confirm)
    expect(document.querySelector('.pachi-box')?.getAttribute('aria-modal')).toBe('true')
  })

  it('custom button text', () => {
    void showBox({ confirmButtonText: 'Close' })
    expect(document.querySelector('.pachi-confirm')?.textContent).toBe('Close')
  })

  it('resolves and closes on button click', async () => {
    const p = showBox({ text: 'x' })
    document.querySelector<HTMLButtonElement>('.pachi-confirm')!.click()
    await expect(p).resolves.toBeUndefined()
    expect(backdrop()).toBeNull()
  })

  it('closes on Escape and removes the key listener', async () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const p = showBox({ text: 'x' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await p
    expect(backdrop()).toBeNull()
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('removes its key listener when the box is detached from outside', async () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const p = showBox({ text: 'x' })
    document.body.innerHTML = ''
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await expect(p).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })

  it('ignores other keys', () => {
    void showBox({ text: 'x' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(backdrop()).not.toBeNull()
  })

  it('closes on backdrop click but not on box click', async () => {
    const p = showBox({ text: 'x' })
    document.querySelector<HTMLElement>('.pachi-box')!.click()
    expect(backdrop()).not.toBeNull()
    backdrop()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await p
    expect(backdrop()).toBeNull()
  })

  it('never interprets text as HTML', () => {
    void showBox({ text: '<img src=x>' })
    expect(document.querySelector('.pachi-box img')).toBeNull()
  })

  it('Box.fire is showBox', () => {
    void Box.fire({ text: 'x' })
    expect(backdrop()).not.toBeNull()
  })
})

describe('injected stylesheet', () => {
  it('contains the dark-mode and narrow-viewport media queries', () => {
    showToast({ text: 'x' })
    const css = document.getElementById('pachi-notify-style')?.textContent ?? ''
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain('@media (max-width: 480px)')
    expect(css).toContain('box-shadow: inset 0 6px 0 var(--pachi-color)')
    expect(css).not.toMatch(/border-top: 6px/)
  })

  /** WCAG relative luminance contrast ratio between two `#rrggbb` colors. */
  const contrast = (a: string, b: string): number => {
    const lum = (h: string): number => {
      const [r, g, bl] = [1, 3, 5]
        .map(i => parseInt(h.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl
    }
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }

  it.each(['success', 'error', 'warning', 'info', 'question'])(
    '%s: text/background reach WCAG AA (4.5:1)',
    icon => {
      const accent = new RegExp(
        `\\.pachi-${icon} \\{ --pachi-color: (#[0-9a-f]{6}); --pachi-dark-bg: (#[0-9a-f]{6});`
      ).exec(notifyStyles)
      expect(accent).not.toBeNull()
      const [, color, darkBg] = accent!
      expect(contrast('#1a1a1a', color)).toBeGreaterThanOrEqual(4.5) // light toast text
      expect(contrast('#111111', color)).toBeGreaterThanOrEqual(4.5) // confirm button text
      expect(contrast('#f5f5f5', darkBg)).toBeGreaterThanOrEqual(4.5) // dark toast text
      expect(contrast(color, '#1e1e1e')).toBeGreaterThanOrEqual(3) // accent against the dark box
    }
  )
  it('box text reaches AA in light and dark mode', () => {
    expect(contrast('#333333', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#e8e8e8', '#1e1e1e')).toBeGreaterThanOrEqual(4.5)
  })
})
