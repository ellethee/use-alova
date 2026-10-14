/**
 * Minimal CSS for toast and notification box.
 * Text/background pairs reach WCAG AA (>= 4.5:1) in light and dark mode (`prefers-color-scheme`, pure CSS):
 * light toasts use dark text (#1a1a1a) on the accent colors (6.2:1 to 10.9:1), dark toasts use light
 * text (#f5f5f5) on dark tinted surfaces (8.9:1 to 10.6:1), the box is #333 on #fff (12.6:1) or #e8e8e8 on
 * #1e1e1e (13.6:1) and the confirm button is #111 on the accent colors (6.8:1 to 11.9:1).
 * Injected at runtime by `Notify.ts`, so no stylesheet import is required.
 */
export const notifyStyles = `
.pachi-toast-container { position: fixed; z-index: 10000; display: flex; flex-direction: column; gap: 8px; padding: 12px; pointer-events: none; max-width: 100vw; }
.pachi-toast-container.pachi-top-end { top: 0; right: 0; }
.pachi-toast-container.pachi-top-start { top: 0; left: 0; }
.pachi-toast-container.pachi-bottom-end { bottom: 0; right: 0; flex-direction: column-reverse; }
.pachi-toast-container.pachi-bottom-start { bottom: 0; left: 0; flex-direction: column-reverse; }
.pachi-toast { pointer-events: auto; display: flex; align-items: flex-start; gap: 12px; min-width: 240px; max-width: 420px; padding: 10px 14px; border-radius: 6px; color: #1a1a1a; font: 14px/1.4 sans-serif; box-shadow: 0 2px 8px rgba(0, 0, 0, .3); }
.pachi-toast .pachi-body { flex: 1; word-break: break-word; }
.pachi-title { font-weight: 600; }
.pachi-close { background: none; border: 0; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; padding: 0; }
.pachi-success { --pachi-color: #a5dc86; --pachi-dark-bg: #1e4620; }
.pachi-error { --pachi-color: #f27474; --pachi-dark-bg: #6b1d1d; }
.pachi-warning { --pachi-color: #f8bb86; --pachi-dark-bg: #5c3a0a; }
.pachi-info { --pachi-color: #3fc3ee; --pachi-dark-bg: #0b4a63; }
.pachi-question { --pachi-color: #87adbd; --pachi-dark-bg: #2f4550; }
.pachi-toast { background: var(--pachi-color); }
.pachi-backdrop { position: fixed; inset: 0; z-index: 10001; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .4); }
.pachi-box { min-width: 280px; max-width: 480px; padding: 20px 24px; border-radius: 8px; background: #fff; color: #333; font: 14px/1.5 sans-serif; box-shadow: inset 0 6px 0 var(--pachi-color), 0 4px 16px rgba(0, 0, 0, .35); }
.pachi-box .pachi-title { font-size: 18px; margin-bottom: 8px; }
.pachi-box .pachi-text { margin-bottom: 16px; word-break: break-word; white-space: pre-wrap; }
.pachi-confirm { display: block; margin-left: auto; padding: 6px 18px; border: 0; border-radius: 4px; background: var(--pachi-color); color: #111; font-size: 14px; cursor: pointer; }
.pachi-box .pachi-title { padding-top: 6px; }
@media (prefers-color-scheme: dark) {
  .pachi-toast { background: var(--pachi-dark-bg); color: #f5f5f5; box-shadow: inset 4px 0 0 var(--pachi-color), 0 2px 8px rgba(0, 0, 0, .6); padding-left: 18px; }
  .pachi-backdrop { background: rgba(0, 0, 0, .6); }
  .pachi-box { background: #1e1e1e; color: #e8e8e8; box-shadow: inset 0 6px 0 var(--pachi-color), 0 4px 16px rgba(0, 0, 0, .7); }
}
@media (max-width: 480px) {
  .pachi-toast-container.pachi-toast-container { left: 0; right: 0; width: auto; max-width: 100%; box-sizing: border-box; padding: 12px; }
  .pachi-toast-container .pachi-toast { min-width: 0; max-width: 100%; width: 100%; box-sizing: border-box; }
  .pachi-box { min-width: 0; max-width: calc(100% - 24px); box-sizing: border-box; }
}
`
