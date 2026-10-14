import { Window } from 'happy-dom'

/**
 * Installs a happy-dom DOM (window, document, location, cookies, Element classes...) on `globalThis`
 * while keeping Node's native `fetch`, `Response`, `Headers`, `FormData`, `Blob`, `File`, `URL`...
 *
 * Why: with the `happy-dom` vitest environment, `fetch` is happy-dom's own, whose `Response.clone()`
 * returns/leaves empty bodies (and alova's fetch adapter always clones the response), so it cannot be
 * used for real end-to-end tests. Use with `// @vitest-environment node`.
 *
 * @param url - The page URL (`location`), used as the "same origin".
 * @returns The happy-dom window.
 */
export function installDom(url: string): Window {
  const win = new Window({ url })
  const g = globalThis as Record<string, unknown>
  for (const key of Object.getOwnPropertyNames(win)) {
    if (key in g) continue
    try {
      g[key] = (win as unknown as Record<string, unknown>)[key]
    } catch {
      /* read-only or throwing getter: skip */
    }
  }
  g.window = win
  g.document = win.document
  g.location = win.location
  return win
}
