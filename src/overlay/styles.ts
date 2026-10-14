/**
 * CSS of the DOM loading overlay and its default spinner.
 *
 * Injected at runtime by `dom-overlay.ts` (single `<style id="pachi-overlay-style">`), so no stylesheet
 * import is required. The very same text is written to `dist/overlay.css` by `scripts/postbuild.mjs`
 * (`@ilpachi/use-alova/styles`: importing it as well has no extra visual effect).
 */
export const overlayStyles = `#use-alova-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.use-alova-spinner {
  border: 8px solid #f3f3f3;
  border-top: 8px solid #3498db;
  border-radius: 50%;
  width: 60px;
  height: 60px;
  animation: use-alova-spin 1s linear infinite;
}

@keyframes use-alova-spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
`
