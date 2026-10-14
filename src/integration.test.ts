// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  createUseAlova as CreateUseAlovaFn,
  ResponseError as ResponseErrorClass,
  UseAlovaOptions,
} from './index'
import type { withFiles as WithFilesFn, FilesApi } from './files/index'
import type { csrfHandler as CsrfHandlerFn } from './csrf/index'
import type { domOverlay as DomOverlayFn } from './overlay/index'
import type { toastMessage as ToastMessageType } from './notify/index'
import { installDom } from './test-utils/dom'
import { getClosedPort, startTestServer } from './test-utils/server'
import type { TestServer } from './test-utils/server'

/**
 * End-to-end tests against a real local HTTP server (no mocks of fetch), with Node's native fetch
 * (happy-dom's `Response.clone()` empties the body, which breaks alova's fetch adapter) and a happy-dom
 * DOM installed by hand (see test-utils/dom.ts). The location is pointed at the server origin so that
 * "same-origin" is real; a second server on another port plays the cross-origin role.
 */
// Vue and the package are imported dynamically AFTER the DOM is installed: Vue's runtime-dom captures
// `document` at import time (otherwise: "Cannot read properties of null (reading 'createComment')").
let createUseAlova: typeof CreateUseAlovaFn
let ResponseError: typeof ResponseErrorClass
let STOP_PROCESSOR: symbol
let defaultErrorHandlers: readonly any[]
let defaultSuccessHandlers: readonly any[]
let fileSuccessHandlers: readonly any[]
let withFiles: typeof WithFilesFn
let csrfHandler: typeof CsrfHandlerFn
let domOverlay: typeof DomOverlayFn
let toastMessage: typeof ToastMessageType
let srv: TestServer
let other: TestServer

/** Waits until a predicate is true (max ~2s). */
async function waitFor(fn: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !fn(); i++) await new Promise(r => setTimeout(r, 20))
}
const toastText = (): string => document.body.textContent ?? ''

/** Creates an api with the plain core defaults (plus overrides) pointing at the local test server. */
function makeApi(extra: Partial<UseAlovaOptions> = {}) {
  return createUseAlova({ baseURL: `${srv.origin}/api`, ...extra })()
}
/** Same, with the toast `errorMessageFunction`, like a typical app. */
function makeToastApi(extra: Partial<UseAlovaOptions> = {}) {
  return makeApi({ errorMessageFunction: toastMessage, ...extra })
}
/** Same, with the file helpers and handlers. */
function makeFilesApi(extra: Partial<UseAlovaOptions> = {}): ReturnType<typeof makeApi> & FilesApi {
  return withFiles(makeApi({ successHandlers: fileSuccessHandlers as any, ...extra }))
}

beforeAll(async () => {
  srv = await startTestServer()
  other = await startTestServer(true)
  installDom(`${srv.origin}/`)
  ;({
    createUseAlova,
    ResponseError,
    STOP_PROCESSOR,
    defaultErrorHandlers,
    defaultSuccessHandlers,
  } = (await import('./index')) as any)
  ;({ fileSuccessHandlers, withFiles } = (await import('./files/index')) as any)
  ;({ csrfHandler } = await import('./csrf/index'))
  ;({ domOverlay } = await import('./overlay/index'))
  ;({ toastMessage } = await import('./notify/index'))
})
afterAll(async () => {
  await srv.close()
  await other.close()
})
beforeEach(() => {
  // Download tests click anchors and leave the page on `blob:...`: restore the same-origin page URL.
  ;(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
    `${srv.origin}/`
  )
  srv.seen.length = 0
  other.seen.length = 0
  document.body.innerHTML = ''
  document.cookie.split(';').forEach(c => {
    document.cookie = `${c.split('=')[0].trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('Destructuring (README usage)', () => {
  it('every $ method works when destructured', async () => {
    const { $get, $post, $put, $patch, $delete } = makeApi()
    expect((await $get<any>('/echo')).method).toBe('GET')
    expect((await $post<any>('/echo', {})).method).toBe('POST')
    expect((await $put<any>('/echo', {})).method).toBe('PUT')
    expect((await $patch<any>('/echo', {})).method).toBe('PATCH')
    expect((await $delete<any>('/echo')).method).toBe('DELETE')
  })
})

describe('JSON and raw bodies (core)', () => {
  it('$get returns parsed JSON', async () => {
    const { $get } = makeApi()
    const data = await $get<any>('/echo')
    expect(data.method).toBe('GET')
  })

  it('$post sends JSON', async () => {
    const { $post } = makeApi()
    const data = await $post<any>('/echo', { a: 1 })
    expect(data.contentType).toMatch(/application\/json/)
    expect(JSON.parse(data.body)).toEqual({ a: 1 })
  })

  it('$post with URLSearchParams and no manual header gets form Content-Type', async () => {
    const { $post } = makeApi()
    const data = await $post<any>('/echo', new URLSearchParams({ q: '1' }))
    expect(data.contentType).toMatch(/^application\/x-www-form-urlencoded/)
    expect(data.body).toBe('q=1')
  })

  it('$post with a typed Blob uses the blob type', async () => {
    const { $post } = makeApi()
    const data = await $post<any>('/echo', new Blob(['hello'], { type: 'text/csv' }))
    expect(data.contentType).toMatch(/^text\/csv/)
    expect(data.body).toBe('hello')
  })

  it('$post with an untyped Blob uses application/octet-stream', async () => {
    const { $post } = makeApi()
    const data = await $post<any>('/echo', new Blob(['hello']))
    expect(data.contentType).toMatch(/^application\/octet-stream/)
  })

  it('$post keeps a manually set Content-Type', async () => {
    const { $post } = makeApi()
    const data = await $post<any>('/echo', new Blob(['x'], { type: 'text/csv' }), {
      headers: { 'Content-Type': 'text/x-custom' },
    })
    expect(data.contentType).toMatch(/^text\/x-custom/)
  })

  it('useAlova(null) works', async () => {
    const useApi = createUseAlova({ baseURL: `${srv.origin}/api` })
    expect((await useApi(null).$get<any>('/echo')).method).toBe('GET')
  })
})

describe('Files subpath: $form, $upload', () => {
  it('$form sends x-www-form-urlencoded', async () => {
    const { $form } = makeFilesApi()
    const data = await $form<any>('/echo', { a: '1', b: 'x y', skip: null })
    expect(data.contentType).toMatch(/^application\/x-www-form-urlencoded/)
    expect(new URLSearchParams(data.body).get('b')).toBe('x y')
    expect(data.body).not.toContain('skip')
  })

  it('$form with a FormData sends its fields; with a file it throws', async () => {
    const { $form } = makeFilesApi()
    const fd = new FormData()
    fd.append('a', '1')
    fd.append('b', 'x y')
    const data = await $form<any>('/echo', fd)
    expect(data.contentType).toMatch(/^application\/x-www-form-urlencoded/)
    expect(new URLSearchParams(data.body).get('b')).toBe('x y')
    fd.append('f', new File(['x'], 'x.txt'))
    expect(() => $form('/echo', fd)).toThrow('use $upload')
  })

  it('$upload sends multipart with boundary, file and extra fields', async () => {
    const { $upload } = makeFilesApi()
    const file = new File(['file-body'], 'a.txt', { type: 'text/plain' })
    const data = await $upload<any>('/echo', file, { note: 'hi' })
    expect(data.contentType).toMatch(/^multipart\/form-data; boundary=/)
    expect(data.body).toContain('name="file"; filename="a.txt"')
    expect(data.body).toContain('file-body')
    expect(data.body).toContain('name="note"')
  })

  it('$upload with several files uses the "files" field', async () => {
    const { $upload } = makeFilesApi()
    const files = [new File(['1'], 'a.txt'), new File(['2'], 'b.txt')]
    const data = await $upload<any>('/echo', files)
    expect(data.body.match(/name="files"/g)).toHaveLength(2)
  })

  it('$upload of an unnamed Blob does not send filename="undefined"', async () => {
    const { $upload } = makeFilesApi()
    const data = await $upload<any>('/echo', new Blob(['content']))
    expect(data.body).toContain('filename="blob"')
    expect(data.body).not.toContain('undefined')
  })

  it('the helpers keep working when destructured next to the core ones', async () => {
    const { $get, $post, $form } = makeFilesApi()
    expect((await $get<any>('/echo')).method).toBe('GET')
    expect((await $post<any>('/echo', {})).method).toBe('POST')
    expect((await $form<any>('/echo', { a: 1 })).method).toBe('POST')
  })
})

describe('Auth and CSRF', () => {
  it('sends Authorization from the token function', async () => {
    const { $get } = makeApi({ token: () => 'abc' })
    const data = await $get<any>('/echo')
    expect(data.authorization).toBe('Bearer abc')
  })

  it('does not overwrite an explicit Authorization header', async () => {
    const { $get } = makeApi({ token: () => 'abc' })
    const data = await $get<any>('/echo', { headers: { Authorization: 'Custom x' } })
    expect(data.authorization).toBe('Custom x')
  })

  it('does not send Authorization to another origin, unless allowed by authOrigins', async () => {
    const token = () => 'abc'
    const denied = createUseAlova({ token })()
    expect((await denied.$get<any>(`${other.origin}/api/echo`)).authorization).toBeNull()
    const allowed = createUseAlova({ token, authOrigins: [other.origin] })()
    expect((await allowed.$get<any>(`${other.origin}/api/echo`)).authorization).toBe('Bearer abc')
  })

  it('awaits an async authHandler', async () => {
    const { $get } = makeApi({
      authHandler: async method => {
        await new Promise(r => setTimeout(r, 20))
        ;(method.config.headers as Record<string, string>).Authorization = 'Async 1'
      },
    })
    expect((await $get<any>('/echo')).authorization).toBe('Async 1')
  })

  it('authHandler: null disables the authentication', async () => {
    const { $get } = makeApi({ authHandler: null, token: 'abc' })
    expect((await $get<any>('/echo')).authorization).toBeNull()
  })

  it('csrfHandler: header from the cookie on same-origin POST and DELETE, not on GET', async () => {
    document.cookie = 'csrftoken=tok123; path=/'
    const { $post, $delete, $get } = makeApi({ beforeRequestHandlers: [csrfHandler()] })
    expect((await $post<any>('/echo', {})).csrf).toBe('tok123')
    expect((await $delete<any>('/echo')).csrf).toBe('tok123')
    expect((await $get<any>('/echo')).csrf).toBeNull()
  })

  it('without csrfHandler no CSRF header is sent', async () => {
    document.cookie = 'csrftoken=tok123; path=/'
    const { $post } = makeApi()
    expect((await $post<any>('/echo', {})).csrf).toBeNull()
  })

  it('csrfHandler never sends the header cross-origin (POST and DELETE)', async () => {
    document.cookie = 'csrftoken=tok123; path=/'
    const api = createUseAlova({
      baseURL: `${other.origin}/api`,
      beforeRequestHandlers: [csrfHandler()],
    })()
    expect((await api.$post<any>('/echo', {})).csrf).toBeNull()
    expect((await api.$delete<any>('/echo')).csrf).toBeNull()
    expect(other.seen.some(r => r.method !== 'OPTIONS')).toBe(true)
  })

  it('csrfHandler honours custom cookie and header names', async () => {
    document.cookie = 'mytoken=zzz; path=/'
    const { $post } = makeApi({
      beforeRequestHandlers: [csrfHandler({ cookieName: 'mytoken', headerName: 'X-My' })],
    })
    expect((await $post<any>('/echo', {})).headers['x-my']).toBe('zzz')
  })
})

describe('Header and URL hardening', () => {
  it('sends ONE value when defaultHeaders and the request differ only in header-name case', async () => {
    const api = makeApi({ defaultHeaders: { Authorization: 'Bearer D', 'X-Case': 'd' } })
    const data = await api.$get<any>('/echo', {
      headers: { authorization: 'Bearer M', 'x-case': 'm' },
    })
    expect(data.authorization).toBe('Bearer M')
    expect(srv.last().headers['x-case']).toBe('m')
  })

  it('does not send the token to a host reached through backslash / control-character urls', async () => {
    const realFetch = globalThis.fetch
    // Browser-like resolution against the page origin: the URL parser maps `\` to `/` and drops tab/newline.
    globalThis.fetch = ((input: any, init?: any) =>
      realFetch(new URL(String(input), `${srv.origin}/`).href, init)) as typeof fetch
    try {
      const api = createUseAlova({ token: () => 'abc' })()
      for (const url of [
        `\\\\127.0.0.1:${other.port}/api/echo`,
        `/\\127.0.0.1:${other.port}/api/echo`,
        `/\t/127.0.0.1:${other.port}/api/echo`,
        `\t//127.0.0.1:${other.port}/api/echo`,
      ]) {
        other.seen.length = 0
        const data = await api.$get<any>(url).catch(() => null)
        expect(other.seen.length, url).toBeGreaterThan(0)
        expect(
          other.seen.every(r => !r.headers.authorization),
          url
        ).toBe(true)
        expect(data?.authorization ?? null).toBeNull()
      }
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('CSRF: a caller header with another spelling is kept and not duplicated', async () => {
    document.cookie = 'csrftoken=tok123; path=/'
    const { $post } = makeApi({ beforeRequestHandlers: [csrfHandler()] })
    const data = await $post<any>('/echo', {}, { headers: { 'x-csrftoken': 'mine' } })
    expect(data.headers['x-csrftoken']).toBe('mine')
  })

  it('CSRF: defaultHeaders under another spelling of the header name gives one value', async () => {
    document.cookie = 'csrftoken=tok123; path=/'
    const { $post } = makeApi({
      defaultHeaders: { 'X-CSRFToken': 'dflt' },
      beforeRequestHandlers: [csrfHandler({ headerName: 'x-csrftoken' })],
    })
    const data = await $post<any>('/echo', {})
    expect(data.headers['x-csrftoken']).toBe('dflt')
  })

  it('a custom authHandler setting Authorization wins over a differently spelled default header, once', async () => {
    const { $get } = makeApi({
      defaultHeaders: { authorization: 'Bearer D' },
      authHandler: method => {
        ;(method.config.headers as Record<string, string>).Authorization = 'Bearer H'
      },
    })
    const data = await $get<any>('/echo')
    expect(data.headers.authorization).toBe('Bearer H')
  })

  it('a beforeRequestHandler adding a differently spelled header also yields one value', async () => {
    const { $get } = makeApi({
      defaultHeaders: { 'X-Case': 'd' },
      beforeRequestHandlers: [
        method => {
          ;(method.config.headers as Record<string, string>)['x-case'] = 'h'
        },
      ],
    })
    expect((await $get<any>('/echo')).headers['x-case']).toBe('h')
  })
})

describe('Errors', () => {
  it('without errorMessageFunction the core shows nothing and rethrows a ResponseError', async () => {
    const { $get } = makeApi()
    const err = (await $get('/status/500').then(
      () => null,
      (e: unknown) => e
    )) as ResponseErrorClass
    expect(err).toBeInstanceOf(ResponseError)
    expect(err.status).toBe(500)
    await new Promise(r => setTimeout(r, 50))
    expect(document.body.innerHTML).toBe('')
  })

  it('4xx/5xx with toastMessage shows a toast and the body is still readable', async () => {
    const { $get } = makeToastApi()
    for (const code of [404, 500]) {
      document.body.innerHTML = ''
      const err = (await $get(`/status/${code}`).then(
        () => null,
        (e: unknown) => e
      )) as ResponseErrorClass
      expect(err).toBeInstanceOf(ResponseError)
      expect(err.status).toBe(code)
      await waitFor(() => toastText().includes(`Error: ${code}`))
      expect(toastText()).toContain(`Error: ${code}`)
      expect(await err.safeResponseJson()).toEqual({ message: 'boom', code })
      expect(await err.response!.text()).toContain('boom')
    }
  })

  it('autoError: false rethrows without a toast', async () => {
    const { $get } = makeToastApi()
    await expect($get('/status/500', { autoError: false })).rejects.toBeInstanceOf(ResponseError)
    await new Promise(r => setTimeout(r, 50))
    expect(toastText()).not.toContain('Error')
  })

  it('a global autoError: false disables the message, a request can turn it back on', async () => {
    const { $get } = makeToastApi({ autoError: false })
    await $get('/status/500').catch(() => null)
    await new Promise(r => setTimeout(r, 50))
    expect(toastText()).not.toContain('Error')
    await $get('/status/500', { autoError: true }).catch(() => null)
    await waitFor(() => toastText().includes('Error: 500'))
    expect(toastText()).toContain('Error: 500')
  })

  it('network error (closed port) gives a ResponseError without response', async () => {
    const port = await getClosedPort()
    const { $get } = createUseAlova({
      baseURL: `http://127.0.0.1:${port}/api`,
      errorMessageFunction: toastMessage,
    })()
    const err = (await $get('/echo').then(
      () => null,
      (e: unknown) => e
    )) as ResponseErrorClass
    expect(err).toBeInstanceOf(ResponseError)
    expect(err.response).toBeUndefined()
    expect(err.status).toBe(0)
    expect(err.cause).toBeInstanceOf(Error)
    await waitFor(() => toastText().includes('Error'))
    expect(toastText()).toContain('Error')
  })

  it('abort does not show a toast', async () => {
    const { $get } = makeToastApi()
    const m = $get('/slow')
    const p = m.send().then(
      () => null,
      (e: unknown) => e
    )
    setTimeout(() => m.abort(), 30)
    const err = (await p) as ResponseErrorClass
    expect(err).toBeInstanceOf(Error)
    await new Promise(r => setTimeout(r, 50))
    expect(toastText()).not.toContain('Error')
  })

  it('custom errorHandlers returning STOP_PROCESSOR swallow the error (resolves null)', async () => {
    const seen = vi.fn()
    const { $get } = makeToastApi({
      errorHandlers: [
        ({ error }) => {
          seen(error?.status)
          return STOP_PROCESSOR as any
        },
      ],
    })
    await expect($get('/status/500')).resolves.toBeNull()
    expect(seen).toHaveBeenCalledWith(500)
    expect(toastText()).not.toContain('Error')
  })

  it('a status map stops one status and lets the others reach the default handler', async () => {
    const { $get } = makeToastApi({
      errorHandlers: [{ 404: () => STOP_PROCESSOR as any }, ...defaultErrorHandlers],
    })
    await expect($get('/status/404')).resolves.toBeNull()
    await expect($get('/status/500')).rejects.toBeInstanceOf(ResponseError)
  })

  it('[value, STOP_PROCESSOR] resolves with the value', async () => {
    const { $get } = makeApi({ errorHandlers: [() => [{ fallback: true }, STOP_PROCESSOR] as any] })
    expect(await $get('/status/500')).toEqual({ fallback: true })
  })

  it('a throwing errorMessageFunction is logged only with debug', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const boom = (): never => {
      throw new Error('boom')
    }
    await makeApi({ errorMessageFunction: boom })
      .$get('/status/500')
      .catch(() => null)
    await new Promise(r => setTimeout(r, 50))
    expect(spy).not.toHaveBeenCalled()
    await makeApi({ errorMessageFunction: boom, debug: true })
      .$get('/status/500')
      .catch(() => null)
    await waitFor(() => spy.mock.calls.some(c => String(c[0]).includes('showMessage failed')))
    expect(spy.mock.calls.some(c => String(c[0]).includes('showMessage failed'))).toBe(true)
  })

  it('a custom errorMessageFunction can read the JSON body', async () => {
    const shown: unknown[] = []
    const { $get } = makeApi({
      errorMessageFunction: async err => {
        shown.push(await err.safeResponseJson())
      },
    })
    await $get('/status/422').catch(() => null)
    await waitFor(() => shown.length > 0)
    expect(shown).toEqual([{ message: 'boom', code: 422 }])
  })
})

describe('Response shapes', () => {
  it('204 empty body resolves to null', async () => {
    const { $get } = makeApi()
    expect(await $get('/empty')).toBeNull()
  })

  it('text/plain falls back to text', async () => {
    const { $get } = makeApi()
    expect(await $get('/text')).toBe('hello plain text')
  })

  it('text/html is parsed to a Document only with the files handlers', async () => {
    const doc = (await makeFilesApi().$get('/html')) as Document
    expect(doc.querySelector('h1')?.textContent).toBe('Hi')
    expect(await makeApi().$get('/html')).toBe('<html><body><h1>Hi</h1></body></html>')
  })
})

describe('Downloads (files subpath)', () => {
  let created: Blob[]
  let clicked: string[]
  beforeEach(() => {
    created = []
    clicked = []
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b)
      return 'blob:fake'
    }) as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    document.addEventListener(
      'click',
      e => {
        clicked.push((e.target as HTMLAnchorElement).download)
      },
      { once: true }
    )
  })
  it('$download uses the Content-Disposition name', async () => {
    const { $download } = makeFilesApi()
    const res = await $download('/file')
    await waitFor(() => created.length > 0)
    expect(created).toHaveLength(1)
    expect(await created[0].text()).toBe('file-content')
    expect(clicked[0]).toBe('report.txt')
    expect(res?.fileName).toBe('report.txt')
  })

  it('$download without Content-Disposition uses config.fileName', async () => {
    const { $download } = makeFilesApi()
    await $download('/rawfile', { fileName: 'x.bin' })
    await waitFor(() => created.length > 0)
    expect(clicked[0]).toBe('x.bin')
    expect(await created[0].text()).toBe('raw-content')
  })

  it('$download without Content-Disposition and without fileName falls back to file.pdf', async () => {
    const { $download } = makeFilesApi()
    await $download('/rawfile')
    await waitFor(() => created.length > 0)
    expect(clicked[0]).toBe('file.pdf')
  })

  it('$download keeps the user meta and a normal $get of the same url is not turned into a blob', async () => {
    const { $download, $get } = makeFilesApi()
    await $download('/rawfile', { meta: { foo: 1 } })
    expect(created).toHaveLength(1)
    expect(await $get('/echo')).toMatchObject({ method: 'GET' })
    expect(created).toHaveLength(1)
  })

  it('$jdownload (POST) saves the file', async () => {
    const { $jdownload } = makeFilesApi()
    await $jdownload('/echo', { id: 1 }, { fileName: 'e.json' })
    await waitFor(() => created.length > 0)
    expect(clicked[0]).toBe('e.json')
    expect(srv.last().method).toBe('POST')
    expect(JSON.parse(srv.last().body.toString())).toEqual({ id: 1 })
  })

  it('$jdownload without fileName falls back to file.pdf', async () => {
    const { $jdownload } = makeFilesApi()
    await $jdownload('/echo', { id: 1 })
    await waitFor(() => created.length > 0)
    expect(clicked[0]).toBe('file.pdf')
  })

  it('$download rejects when saving the file fails', async () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error('no blob url')
    }) as unknown as typeof URL.createObjectURL
    const { $download } = makeFilesApi()
    await expect($download('/file')).rejects.toThrow('no blob url')
  })

  it('$download rejects on HTTP errors, and resolves null when an error handler swallows them', async () => {
    await expect(makeFilesApi().$download('/status/500')).rejects.toBeInstanceOf(ResponseError)
    const swallowed = makeFilesApi({ errorHandlers: [() => STOP_PROCESSOR as any] })
    expect(await swallowed.$download('/status/500')).toBeNull()
  })

  it('$download without blobHandler fails with a clear message instead of saving garbage', async () => {
    const api = withFiles(makeApi())
    await expect(api.$download('/echo')).rejects.toThrow('add blobHandler')
    expect(created).toHaveLength(0)
  })
})

describe('Overlay (overlay subpath + core adapter)', () => {
  const overlay = (): Element | null => document.getElementById('use-alova-overlay')

  it('without an overlay adapter nothing is shown, even with showOverlay: true', async () => {
    const { $get } = makeApi()
    const p = $get('/slow2', { showOverlay: true }).send()
    await new Promise(r => setTimeout(r, 30))
    expect(overlay()).toBeNull()
    await p
  })

  it('concurrent requests keep the overlay until the last one finishes', async () => {
    const { $get } = makeApi({ overlay: domOverlay() })
    const slow = $get('/slow', { showOverlay: true }).send()
    const fast = $get('/slow2', { showOverlay: true }).send()
    await waitFor(() => overlay() !== null)
    expect(overlay()).not.toBeNull()
    await fast
    expect(overlay()).not.toBeNull()
    await slow
    expect(overlay()).toBeNull()
  })

  it('manual mode (default): requests without showOverlay show nothing', async () => {
    const { $get } = makeApi({ overlay: domOverlay() })
    const p = $get('/slow2').send()
    await new Promise(r => setTimeout(r, 30))
    expect(overlay()).toBeNull()
    await p
  })

  it('auto mode: every request shows it, showOverlay: false opts out', async () => {
    const { $get } = makeApi({ overlay: domOverlay({ mode: 'auto' }) })
    const p = $get('/slow2').send()
    await waitFor(() => overlay() !== null)
    expect(overlay()).not.toBeNull()
    await p
    expect(overlay()).toBeNull()
    const q = $get('/slow2', { showOverlay: false }).send()
    await new Promise(r => setTimeout(r, 30))
    expect(overlay()).toBeNull()
    await q
  })

  it('delay: a fast response never flashes the overlay, a slow one shows it', async () => {
    const show = vi.fn()
    const hide = vi.fn()
    const { $get } = makeApi({ overlay: { mode: 'auto', delay: 100, show, hide } })
    await $get('/echo')
    expect(show).not.toHaveBeenCalled()
    expect(hide).not.toHaveBeenCalled()
    await $get('/slow') // 400 ms
    expect(show).toHaveBeenCalledTimes(1)
    expect(hide).toHaveBeenCalledTimes(1)
  })

  it('a custom adapter gets show at the first request and hide at the last', async () => {
    const calls: string[] = []
    const { $get } = makeApi({
      overlay: { show: () => calls.push('show'), hide: () => calls.push('hide') },
    })
    await Promise.all([
      $get('/slow', { showOverlay: true }).send(),
      $get('/slow2', { showOverlay: true }).send(),
    ])
    expect(calls).toEqual(['show', 'hide'])
  })

  it('the overlay is released after an error', async () => {
    const { $get } = makeApi({ overlay: domOverlay() })
    await $get('/status/500', { showOverlay: true }).catch(() => null)
    expect(overlay()).toBeNull()
  })

  it('the overlay is released before the error handlers run (they may open dialogs)', async () => {
    const seen: Array<Element | null> = []
    const { $get } = makeApi({
      overlay: domOverlay(),
      errorHandlers: [
        () => {
          seen.push(overlay())
          return STOP_PROCESSOR as any
        },
      ],
    })
    await $get('/status/500', { showOverlay: true })
    expect(seen).toEqual([null])
  })

  it('the overlay is released after an abort and after a network error', async () => {
    const { $get } = makeApi({ overlay: domOverlay() })
    const m = $get('/slow', { showOverlay: true })
    const p = m.send().catch(() => null)
    await waitFor(() => overlay() !== null)
    m.abort()
    await p
    expect(overlay()).toBeNull()
    const port = await getClosedPort()
    const bad = createUseAlova({ baseURL: `http://127.0.0.1:${port}/api`, overlay: domOverlay() })()
    await bad.$get('/x', { showOverlay: true }).catch(() => null)
    expect(overlay()).toBeNull()
  })

  it('a cache hit never calls show or hide, even without a delay', async () => {
    const show = vi.fn()
    const hide = vi.fn()
    const { $get } = makeApi({ overlay: { show, hide } })
    await $get('/echo?cached', { cacheFor: 60000, showOverlay: true })
    expect(show).toHaveBeenCalledTimes(1)
    expect(hide).toHaveBeenCalledTimes(1)
    await $get('/echo?cached', { cacheFor: 60000, showOverlay: true })
    expect(show).toHaveBeenCalledTimes(1)
    expect(hide).toHaveBeenCalledTimes(1)
    expect(srv.seen.filter(r => r.path === '/api/echo')).toHaveLength(1)
  })

  it('a forced request (send(true)) goes to the network and shows the overlay', async () => {
    const show = vi.fn()
    const { $get } = makeApi({ overlay: { show, hide: vi.fn() } })
    await $get('/echo?forced', { cacheFor: 60000, showOverlay: true })
    await $get('/echo?forced', { cacheFor: 60000, showOverlay: true }).send(true)
    expect(show).toHaveBeenCalledTimes(2)
  })

  it('the delay starts when the request goes to the network', async () => {
    const show = vi.fn()
    const { $get } = makeApi({ overlay: { mode: 'auto', delay: 150, show, hide: vi.fn() } })
    await $get('/slow') // 400 ms
    expect(show).toHaveBeenCalledTimes(1)
  })
})

describe('cacheFor option', () => {
  const hits = (q: string): number =>
    srv.seen.filter(r => r.path === '/api/echo' && q !== '').length

  it("default: alova's cache serves the second identical GET", async () => {
    const { $get } = makeApi()
    await $get('/echo?c-default')
    await $get('/echo?c-default')
    expect(hits('c')).toBe(1)
  })

  it('cacheFor: null and { GET: null } disable the cache', async () => {
    for (const cacheFor of [null, { GET: null }] as const) {
      srv.seen.length = 0
      const { $get } = makeApi({ cacheFor })
      await $get('/echo?c-off')
      await $get('/echo?c-off')
      expect(hits('c'), JSON.stringify(cacheFor)).toBe(2)
    }
  })

  it('a numeric global cacheFor keeps working and a request can override it in both directions', async () => {
    const on = makeApi({ cacheFor: { GET: 60000 } })
    await on.$get('/echo?c-on')
    await on.$get('/echo?c-on')
    expect(hits('c')).toBe(1)
    srv.seen.length = 0
    await on.$get('/echo?c-on-override', { cacheFor: 0 })
    await on.$get('/echo?c-on-override', { cacheFor: 0 })
    expect(hits('c')).toBe(2)
    srv.seen.length = 0
    const off = makeApi({ cacheFor: null })
    await off.$get('/echo?c-off-override', { cacheFor: 60000 })
    await off.$get('/echo?c-off-override', { cacheFor: 60000 })
    expect(hits('c')).toBe(1)
  })
})

describe('meta aliases and authType function', () => {
  it('meta.autoError: false silences the message, the config wins over meta', async () => {
    const { $get } = makeToastApi()
    await $get('/status/500', { meta: { autoError: false } }).catch(() => null)
    await new Promise(r => setTimeout(r, 50))
    expect(toastText()).not.toContain('Error')
    await $get('/status/500', { meta: { autoError: false }, autoError: true }).catch(() => null)
    await waitFor(() => toastText().includes('Error: 500'))
    expect(toastText()).toContain('Error: 500')
  })

  it('meta.spinner shows the overlay (manual mode); the config wins', async () => {
    const show = vi.fn()
    const { $get } = makeApi({ overlay: { show, hide: vi.fn() } })
    await $get('/echo', { meta: { spinner: true } })
    expect(show).toHaveBeenCalledTimes(1)
    await $get('/echo?x', { meta: { spinner: true }, showOverlay: false })
    expect(show).toHaveBeenCalledTimes(1)
    const auto = makeApi({ overlay: { mode: 'auto', show, hide: vi.fn() } })
    await auto.$get('/echo?y', { meta: { spinner: false } })
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('non-boolean meta values and other meta keys are ignored', async () => {
    const show = vi.fn()
    const { $get } = makeApi({ overlay: { show, hide: vi.fn() } })
    await $get('/echo', { meta: { spinner: 'yes', autoError: 1, other: true } })
    expect(show).not.toHaveBeenCalled()
  })

  it('authType as a function is called per request; undefined or empty falls back to Bearer', async () => {
    let type: string | undefined = 'bearer-x'
    const { $get } = makeApi({ token: () => 'abc', authType: () => type })
    expect((await $get<any>('/echo?a1')).authorization).toBe('bearer-x abc')
    type = undefined
    expect((await $get<any>('/echo?a2')).authorization).toBe('Bearer abc')
    type = ''
    expect((await $get<any>('/echo?a3')).authorization).toBe('Bearer abc')
  })
})

describe('Cache logging', () => {
  it('a repeated GET prints no [HitCache] noise unless debug is on', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const quiet = makeApi()
    await quiet.$get('/echo?quiet')
    await quiet.$get('/echo?quiet')
    expect(log.mock.calls.flat().join(' ')).not.toContain('HitCache')
    const noisy = makeApi({ debug: true })
    await noisy.$get('/echo?noisy')
    await noisy.$get('/echo?noisy')
    expect(log.mock.calls.flat().join(' ')).toContain('HitCache')
  })
})

describe('unwrapEnvelope', () => {
  it('is off by default: the envelope is returned as is', async () => {
    const { $get } = makeApi()
    expect(await $get('/envelope')).toEqual({ success: true, message: 'ok', data: { id: 1 } })
  })

  it('returns only `data` of { success, message, data } 2xx responses', async () => {
    const { $get } = makeApi({ unwrapEnvelope: true })
    expect(await $get('/envelope')).toEqual({ id: 1 })
    expect(await $get('/envelope-list')).toEqual([1, 2])
  })

  it('JSON without the envelope keys passes through unchanged', async () => {
    const { $get, $post } = makeApi({ unwrapEnvelope: true })
    expect(await $get('/plain-json')).toEqual({ access_token: 'tok' })
    const echo = await $post<any>('/echo', { success: 'yes', data: 1 })
    expect(echo.method).toBe('POST')
  })

  it('204/205/empty bodies still resolve null, text stays text', async () => {
    const { $get } = makeApi({ unwrapEnvelope: true })
    expect(await $get('/empty')).toBeNull()
    expect(await $get('/205')).toBeNull()
    expect(await $get('/text')).toBe('hello plain text')
  })

  it('can be overridden per request, in both directions', async () => {
    const on = makeApi({ unwrapEnvelope: true })
    expect(await on.$get('/envelope', { unwrapEnvelope: false })).toMatchObject({ success: true })
    const off = makeApi()
    expect(await off.$get('/envelope', { unwrapEnvelope: true })).toEqual({ id: 1 })
  })

  it('does not touch error responses', async () => {
    const { $get } = makeApi({ unwrapEnvelope: true })
    const err = (await $get('/status/500').then(
      () => null,
      (e: unknown) => e
    )) as ResponseErrorClass
    expect(await err.safeResponseJson()).toEqual({ message: 'boom', code: 500 })
  })

  it('works together with the files handlers', async () => {
    const api = makeFilesApi({ unwrapEnvelope: true })
    expect(await api.$get('/envelope')).toEqual({ id: 1 })
  })
})

describe('envelopeErrors', () => {
  it("'data' (default): success: false with 200 resolves with data, no error", async () => {
    const { $get } = makeToastApi({ unwrapEnvelope: true })
    expect(await $get('/envelope-false')).toBeNull()
    expect(
      await makeToastApi({ unwrapEnvelope: true, envelopeErrors: 'data' }).$get('/envelope-false')
    ).toBeNull()
  })

  it("'throw': rejects with a ResponseError (status 200, message from the envelope, readable body) and shows the toast", async () => {
    const { $get } = makeToastApi({ unwrapEnvelope: true, envelopeErrors: 'throw' })
    const err = (await $get('/envelope-false').then(
      () => null,
      (e: unknown) => e
    )) as ResponseErrorClass
    expect(err).toBeInstanceOf(ResponseError)
    expect(err.status).toBe(200)
    expect(err.message).toBe('nope')
    expect(await err.safeResponseJson()).toEqual({ success: false, message: 'nope', data: null })
    expect(await err.response!.text()).toContain('"success":false')
    await waitFor(() => toastText().includes('Error: 200'))
    expect(toastText()).toContain('Error: 200')
  })

  it("'throw' leaves success: true and plain JSON alone", async () => {
    const { $get } = makeApi({ unwrapEnvelope: true, envelopeErrors: 'throw' })
    expect(await $get('/envelope')).toEqual({ id: 1 })
    expect(await $get('/plain-json')).toEqual({ access_token: 'tok' })
  })

  it("'throw' needs unwrapEnvelope: without it the envelope is returned as is", async () => {
    const { $get } = makeApi({ envelopeErrors: 'throw' })
    expect(await $get('/envelope-false')).toMatchObject({ success: false })
  })

  it('can be overridden per request in both directions', async () => {
    const strict = makeApi({ unwrapEnvelope: true, envelopeErrors: 'throw' })
    expect(await strict.$get('/envelope-false', { envelopeErrors: 'data' })).toBeNull()
    const lax = makeApi({ unwrapEnvelope: true })
    await expect(lax.$get('/envelope-false', { envelopeErrors: 'throw' })).rejects.toBeInstanceOf(
      ResponseError
    )
    await expect(
      makeApi({ envelopeErrors: 'throw' }).$get('/envelope-false', { unwrapEnvelope: true })
    ).rejects.toBeInstanceOf(ResponseError)
  })

  it('autoError: false rethrows without a toast', async () => {
    const { $get } = makeToastApi({ unwrapEnvelope: true, envelopeErrors: 'throw' })
    await expect($get('/envelope-false', { autoError: false })).rejects.toBeInstanceOf(
      ResponseError
    )
    await new Promise(r => setTimeout(r, 50))
    expect(toastText()).not.toContain('Error')
  })

  it("errorHandlers status maps match the response status, including '2xx' and '200'", async () => {
    const seen: string[] = []
    const { $get } = makeApi({
      unwrapEnvelope: true,
      envelopeErrors: 'throw',
      errorHandlers: [
        {
          '4xx': () => {
            seen.push('4xx')
          },
          '2xx': ({ error }: any) => {
            seen.push(`2xx:${error.message}`)
            return ['handled', STOP_PROCESSOR] as any
          },
        },
        ...defaultErrorHandlers,
      ],
    })
    expect(await $get('/envelope-false')).toBe('handled')
    expect(seen).toEqual(['2xx:nope'])
    const exact = makeApi({
      unwrapEnvelope: true,
      envelopeErrors: 'throw',
      errorHandlers: [{ 200: () => STOP_PROCESSOR as any }],
    })
    expect(await exact.$get('/envelope-false')).toBeNull()
  })

  it('a custom handler for 5xx does not see the envelope error, and real HTTP errors are unchanged', async () => {
    const seen = vi.fn()
    const { $get } = makeApi({
      unwrapEnvelope: true,
      envelopeErrors: 'throw',
      errorHandlers: [
        {
          '5xx': () => {
            seen()
          },
        },
        ...defaultErrorHandlers,
      ],
    })
    await expect($get('/envelope-false')).rejects.toBeInstanceOf(ResponseError)
    expect(seen).not.toHaveBeenCalled()
    await expect($get('/status/500')).rejects.toBeInstanceOf(ResponseError)
    expect(seen).toHaveBeenCalledOnce()
  })

  it('the overlay is released before the error handlers run', async () => {
    const seen: Array<Element | null> = []
    const { $get } = makeApi({
      overlay: domOverlay(),
      unwrapEnvelope: true,
      envelopeErrors: 'throw',
      errorHandlers: [
        () => {
          seen.push(document.getElementById('use-alova-overlay'))
          return STOP_PROCESSOR as any
        },
      ],
    })
    await $get('/envelope-false', { showOverlay: true })
    expect(seen).toEqual([null])
    expect(document.getElementById('use-alova-overlay')).toBeNull()
  })

  it('retry() works from the envelope error (once, then rejects)', async () => {
    const { $get } = makeApi({
      unwrapEnvelope: true,
      envelopeErrors: 'throw',
      errorHandlers: [
        async ({ retry, retried }: any) =>
          retried ? undefined : [await retry().catch(() => 'second failed'), STOP_PROCESSOR],
        ...defaultErrorHandlers,
      ],
    })
    expect(await $get('/envelope-false')).toBe('second failed')
    expect(srv.seen.filter(r => r.path === '/api/envelope-false')).toHaveLength(2)
  })
})

describe('retry', () => {
  /** Api whose 401 handler "refreshes" the token, then retries (the documented pattern). */
  function makeRefreshApi(newToken: string, onRefresh = vi.fn()) {
    let token = 'stale'
    const api = makeToastApi({
      token: () => token,
      errorHandlers: [
        {
          401: async ({ retry, retried }: any) => {
            if (retried) return undefined
            onRefresh()
            token = newToken
            return [await retry(), STOP_PROCESSOR]
          },
        },
        ...defaultErrorHandlers,
      ],
    })
    return { api, onRefresh }
  }
  it('401 -> refresh -> retry resolves with the result of the second request, with the new token', async () => {
    const { api, onRefresh } = makeRefreshApi('fresh')
    const data = await api.$get<any>('/protected')
    expect(data).toEqual({ ok: true, method: 'GET', body: '' })
    expect(onRefresh).toHaveBeenCalledOnce()
    const seen = srv.seen.filter(r => r.path === '/api/protected')
    expect(seen.map(r => r.headers.authorization)).toEqual(['Bearer stale', 'Bearer fresh'])
    await new Promise(r => setTimeout(r, 30))
    expect(toastText()).not.toContain('Error')
  })

  it('retries a POST with the same body', async () => {
    const { api } = makeRefreshApi('fresh')
    const data = await api.$post<any>('/protected', { a: 1 })
    expect(data.method).toBe('POST')
    expect(JSON.parse(data.body)).toEqual({ a: 1 })
    expect(srv.seen.filter(r => r.path === '/api/protected')).toHaveLength(2)
  })

  it('an explicit Authorization header of the request is restored as the caller set it', async () => {
    let calls = 0
    const api = makeApi({
      errorHandlers: [
        async ({ retry, retried }: any) => (retried ? undefined : [await retry(), STOP_PROCESSOR]),
      ],
      beforeRequestHandlers: [
        method => {
          // The second attempt must start again from the caller's headers, not from the first attempt's.
          calls++
          ;(method.config.headers as Record<string, string>)['X-Attempt'] = String(calls)
        },
      ],
    })
    await api.$get('/status/500').catch(() => null)
    const attempts = srv.seen.filter(r => r.path === '/api/status/500')
    expect(attempts.map(r => r.headers['x-attempt'])).toEqual(['1', '2'])
  })

  it('retries only once: a second 401 reaches the next handlers and rejects, without loops', async () => {
    const { api, onRefresh } = makeRefreshApi('still-wrong')
    const err = (await api.$get('/protected').then(
      () => null,
      (e: unknown) => e
    )) as ResponseErrorClass
    expect(err).toBeInstanceOf(ResponseError)
    expect(err.status).toBe(401)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(srv.seen.filter(r => r.path === '/api/protected')).toHaveLength(2)
    await waitFor(() => toastText().includes('Error: 401'))
    expect(toastText()).toContain('Error: 401')
  })

  it('calling retry() on an already retried request rejects with the error instead of looping', async () => {
    const api = makeApi({
      errorHandlers: [async ({ retry }: any) => [await retry(), STOP_PROCESSOR]],
    })
    const err = (await api.$get('/status/500').then(
      () => null,
      (e: unknown) => e
    )) as ResponseErrorClass
    expect(err).toBeInstanceOf(ResponseError)
    expect(err.status).toBe(500)
    expect(srv.seen.filter(r => r.path === '/api/status/500')).toHaveLength(2)
  })

  it('works for network errors too', async () => {
    const port = await getClosedPort()
    let retried = 0
    const bad = createUseAlova({
      baseURL: `http://127.0.0.1:${port}/api`,
      errorHandlers: [
        async ({ retry, retried: already }: any) => {
          if (already) return undefined
          retried++
          return [await retry().catch(() => 'gave up'), STOP_PROCESSOR]
        },
        ...defaultErrorHandlers,
      ],
    })()
    expect(await bad.$get('/x')).toBe('gave up')
    expect(retried).toBe(1)
  })

  it('is available (with retried: false) on a normal first run', async () => {
    const seen: boolean[] = []
    const api = makeApi({
      successHandlers: [
        ({ retried, retry }: any) => {
          seen.push(retried, typeof retry === 'function')
        },
        ...defaultSuccessHandlers,
      ],
    })
    await api.$get('/echo')
    expect(seen).toEqual([false, true])
  })

  it('does not change the original Method: sending it again starts from scratch', async () => {
    const { api } = makeRefreshApi('fresh')
    const method = api.$get<any>('/protected')
    await method.send(true)
    srv.seen.length = 0
    await method.send(true)
    // second send of the same Method object: token already "fresh" in the closure, a single request
    expect(srv.seen.filter(r => r.path === '/api/protected')).toHaveLength(1)
  })

  /** Api whose 401 handler waits `refreshMs` before retrying; records what happened. */
  function makeSlowRefreshApi(refreshMs: number) {
    let token = 'stale'
    const outcome: { error?: ResponseErrorClass; retryStarted: boolean } = { retryStarted: false }
    const api = makeApi({
      token: () => token,
      errorHandlers: [
        {
          401: async ({ retry }: any) => {
            await new Promise(r => setTimeout(r, refreshMs))
            token = 'fresh'
            outcome.retryStarted = true
            try {
              return [await retry(), STOP_PROCESSOR]
            } catch (e) {
              outcome.error = e as ResponseErrorClass
              throw e
            }
          },
        },
        ...defaultErrorHandlers,
      ],
    })
    return { api, outcome }
  }

  it('method.abort() while the token is being refreshed: no retry is sent, the error is an abort', async () => {
    const { api, outcome } = makeSlowRefreshApi(150)
    const method = api.$get('/protected')
    const result = method.send().then(
      () => null,
      (e: unknown) => e
    ) as Promise<ResponseErrorClass>
    await waitFor(() => srv.seen.length > 0)
    method.abort()
    const err = await result
    expect(err).toBeInstanceOf(ResponseError)
    expect(err.isAbort).toBe(true)
    expect(outcome.error?.isAbort).toBe(true)
    expect(srv.seen.filter(r => r.path === '/api/protected')).toHaveLength(1)
  })

  it('an AbortController signal aborted while the token is being refreshed: no retry is sent', async () => {
    const { api } = makeSlowRefreshApi(150)
    const ctrl = new AbortController()
    const result = api
      .$get('/protected', { signal: ctrl.signal })
      .send()
      .then(
        () => null,
        (e: unknown) => e
      ) as Promise<ResponseErrorClass>
    await waitFor(() => srv.seen.length > 0)
    ctrl.abort()
    const err = await result
    expect(err.isAbort).toBe(true)
    expect(srv.seen.filter(r => r.path === '/api/protected')).toHaveLength(1)
  })

  it('method.abort() during the retried request aborts it and rejects with an abort error', async () => {
    const { api } = makeSlowRefreshApi(0)
    const method = api.$get('/slow-protected')
    const result = method.send().then(
      () => null,
      (e: unknown) => e
    ) as Promise<ResponseErrorClass>
    await waitFor(() => srv.seen.filter(r => r.path === '/api/slow-protected').length >= 2)
    method.abort()
    const err = await result
    expect(err).toBeInstanceOf(ResponseError)
    expect(err.isAbort).toBe(true)
    await new Promise(r => setTimeout(r, 30))
    expect(toastText()).not.toContain('Error')
  })

  it('an aborted request does not block a new send of the same method', async () => {
    const { api } = makeSlowRefreshApi(0)
    const method = api.$get<any>('/protected')
    await method.send(true) // 401 -> retry with the fresh token
    method.abort() // no-op: the request is over
    srv.seen.length = 0
    expect(await method.send(true)).toEqual({ ok: true, method: 'GET', body: '' })
  })

  it('the overlay is released across the retry', async () => {
    const calls: string[] = []
    let token = 'stale'
    const api = makeApi({
      token: () => token,
      overlay: { show: () => calls.push('show'), hide: () => calls.push('hide') },
      errorHandlers: [
        {
          401: async ({ retry }: any) => {
            token = 'fresh'
            return [await retry(), STOP_PROCESSOR]
          },
        },
      ],
    })
    await api.$get('/protected', { showOverlay: true })
    expect(calls.filter(c => c === 'show').length).toBe(calls.filter(c => c === 'hide').length)
    expect(calls.at(-1)).toBe('hide')
  })
})
