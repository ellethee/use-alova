# @ilpachi/use-alova

> **Status: beta.** The API may evolve between releases: see the CHANGELOG. Provided "as is", without warranty of any kind (see [LICENSE](./LICENSE)). Not recommended for production use without pinning versions and testing against your backend.

Vue 3 wrapper for [alova](https://alova.js.org/): a small core with token authentication, header merging, response pipelines and centralized error handling, plus optional, tree-shakable subpaths for notifications, a loading overlay, file helpers and CSRF. No dependencies, fully typed.

## Install

```bash
pnpm add @ilpachi/use-alova   # peer dependencies: vue ^3, alova ^3.3.0
```

Requires Node >= 20. Recommended `tsconfig.json` settings:

```json
{ "compilerOptions": { "moduleResolution": "bundler", "skipLibCheck": true } }
```

With `skipLibCheck: false`, even `bundler` shows errors coming from alova's own `.d.ts` files (react/solid/svelte/vue-demi), and `node16`/`nodenext` can report `TS2305` on `alova/client`. These come from alova's typings, not from this package.

## Subpaths

The core (`@ilpachi/use-alova`) has no UI, no DOM and never imports the subpaths: import only what you use. Every subpath is available as ESM and CommonJS, with types.

| Import | Contents |
| --- | --- |
| `@ilpachi/use-alova` | `createUseAlova`, `UseAlovaPlugin`, `useAlova`, `getUseAlovaInstance`, `USE_ALOVA_KEY`, `defaultAuthHandler`, `defaultErrorHandler`, `defaultJsonHandler`, `defaultSuccessHandlers`, `defaultErrorHandlers`, `STOP_PROCESSOR`, `ResponseError` and the types |
| `@ilpachi/use-alova/notify` | `Toast`, `Box`, `showToast`, `showBox`, `toastMessage`, `boxMessage`, `createToastMessage`, `createBoxMessage`, `NotifyOptions` |
| `@ilpachi/use-alova/overlay` | `domOverlay` (dependency-free full-page overlay with a spinner) |
| `@ilpachi/use-alova/files` | `withFiles` (`$download`, `$jdownload`, `$form`, `$upload`), `blobHandler`, `domHandler`, `fileSuccessHandlers` |
| `@ilpachi/use-alova/csrf` | `csrfHandler`, `getCookie` |
| `@ilpachi/use-alova/styles` | The overlay CSS as a file (optional: the overlay injects the same CSS at runtime) |

The alova hooks (`useRequest`, `usePagination`, `useWatcher`, `useUploader`) come from `alova/client`.

## Quick start

```ts
// main.ts
import { createApp } from 'vue'
import { UseAlovaPlugin } from '@ilpachi/use-alova'
import { toastMessage } from '@ilpachi/use-alova/notify'
import { domOverlay } from '@ilpachi/use-alova/overlay'
import { csrfHandler } from '@ilpachi/use-alova/csrf'
import { useUserStore } from './stores/user-store' // your own store (e.g. Pinia)
import App from './App.vue'

const app = createApp(App)
app.use(UseAlovaPlugin, {
  baseURL: '/api',
  token: () => useUserStore().token,        // token source (called for every request)
  errorMessageFunction: toastMessage,       // optional: show errors in a toast
  overlay: domOverlay({ delay: 200 }),      // optional: spinner for requests with showOverlay: true
  beforeRequestHandlers: [csrfHandler()],   // optional: CSRF header from the cookie
})
app.mount('#app')
```

```vue
<script setup lang="ts">
import { useRequest } from 'alova/client'
import { useAlova } from '@ilpachi/use-alova'

// `url` is appended to `baseURL`: requests go to `/api/items/list`.
const { $get } = useAlova({ url: '/items' })
const { data, loading } = useRequest(() => $get('/list', { showOverlay: true }), { immediate: true })
</script>
```

Without Vue (plain TypeScript modules), use the factory:

```ts
import { createUseAlova } from '@ilpachi/use-alova'

export const useApi = createUseAlova({ baseURL: '/api' })
const { $post } = useApi({ url: '/users' })
await $post('/', { name: 'Ada' })
```

## Options (`UseAlovaOptions`)

Options explicitly set to `undefined` do not override the defaults. Every default is listed here.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `baseURL` | `string` | `undefined` | Prefix of every request (relative or absolute), joined with the request url by plain path concatenation. |
| `debug` | `boolean` | `false` | Logs request errors and failures of the message function, and alova's `[HitCache]` message on GET cache hits. |
| `autoError` | `boolean` | `true` | Calls `errorMessageFunction` before rethrowing an error. Overridable per request. Irrelevant without `errorMessageFunction`. |
| `errorMessageFunction` | `(err: ResponseError) => void \| Promise<void>` | `undefined` | Shows an error to the user. Without it the core shows nothing and just rethrows. `@ilpachi/use-alova/notify` provides ready ones. |
| `unwrapEnvelope` | `boolean` | `false` | 2xx JSON responses shaped `{ success, message?, data }` resolve with just `data` (see "Pipelines"). Overridable per request. |
| `envelopeErrors` | `'data' \| 'throw'` | `'data'` | With `unwrapEnvelope`, what a 2xx envelope with `success: false` does: resolve with `data`, or reject with a `ResponseError` (see "Envelopes"). Overridable per request. |
| `cacheFor` | `Partial<Record<'GET' \| 'POST' \| ..., number \| Date \| null>> \| null` | alova's default | Global cache time per HTTP method, passed to alova (default: GET cached for 5 minutes). `null` or `{ GET: null }` disables the cache. A request can override it with its own `cacheFor`. |
| `defaultHeaders` | `Record<string, string>` | `undefined` | Headers merged into every request (case-insensitively; the request wins). |
| `token` | `string \| ((method) => string \| null \| undefined \| Promise<...>)` | `undefined` | Token of the default `authHandler`. A function is called for every request (it may be async), e.g. `() => userStore.token`. |
| `authType` | `string \| ((method) => string \| undefined)` | `'Bearer'` | Scheme of the `Authorization` header: `<authType> <token>`. A function is called for every request (for example to use the `token_type` sent by the backend); `undefined` or `''` mean `'Bearer'`. |
| `authOrigins` | `string[]` | `undefined` | Extra origins that may receive `Authorization` on absolute-url requests, e.g. `['https://api.example.com']`. |
| `authHandler` | `(method, options) => void \| Promise<void>` or `null` | `defaultAuthHandler` | Sets the authentication; `null` disables it. |
| `beforeRequestHandlers` | `(fn \| STOP_PROCESSOR)[]` | `undefined` | Functions run before each request, after `authHandler`. Returning `false` or `STOP_PROCESSOR` skips the following ones. |
| `successHandlers` | processor set | `defaultSuccessHandlers` | Pipeline for 2xx responses (JSON/text parsing). |
| `errorHandlers` | processor set | `defaultErrorHandlers` | Pipeline for errors (shows the message when there is an `errorMessageFunction`, then rethrows). |
| `completeHandlers` | processor set | `[]` | Pipeline run when the request completes. |
| `overlay` | `OverlayOptions` | `undefined` | Busy-indicator adapter: `{ mode?: 'manual' \| 'auto', delay?: number, show?, hide? }` (see "Overlay"). |

- `errorHandlers`, `successHandlers` and `completeHandlers` set to `null` are the same as `[]` (only `undefined` selects the defaults).
- Pipeline sets accept functions, `STOP_PROCESSOR` and maps keyed by status (`'404'`, `'4xx'`, `'401,403'`, `'2xx,404'`, ...).

## Per-request config (`UseAlovaMethodConfig`)

Passed in the config of a single request (`$get(url, config)`, ...), also typed on `method.config` inside handlers (`UseAlovaMethod`). Standard alova fields (`headers`, `params`, `cacheFor`, ...) are accepted too.

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `autoError` | `boolean` | global `autoError` | `false` rethrows without calling `errorMessageFunction`. Alias: `meta: { autoError }`. |
| `showOverlay` | `boolean` | per `overlay.mode` | `true` shows the overlay, `false` never shows it (even with `mode: 'auto'`). Alias: `meta: { spinner }`. |
| `unwrapEnvelope` | `boolean` | global `unwrapEnvelope` | Unwraps (or not) the `{ success, data }` envelope for this request. |
| `envelopeErrors` | `'data' \| 'throw'` | global `envelopeErrors` | `'throw'` rejects on `success: false` (needs `unwrapEnvelope`). |
| `fileName` | `string` | `'file.pdf'` | `./files`: marks the response as a file and names it when `Content-Disposition` has no `filename`. |
| `fieldName` | `string` | `'file'` / `'files'` | `./files`: `FormData` field used by `$upload` (single file / array). |

`meta` aliases: `method.meta.autoError` and `method.meta.spinner` (booleans, for example `$get(url, { meta: { autoError: false, spinner: true } })`) are read as `autoError` and `showOverlay`; the config fields win when both are set, and other `meta` keys and non-boolean values are ignored. `meta` stays `any` (alova's own type): `@ilpachi/use-alova` itself only uses the internal keys `useAlovaDownload` and `__useAlovaRetried`.

## Returned API (`useAlova(params?)`)

`useAlova({ url })` is memoized per `url` (every distinct `url` keeps an alova instance): do not pass dynamic values, pass them per request (``$get(`/items/${id}`)``). It returns:

- `alova` (the alova instance) and `useAlovaOptions` (resolved options).
- `$get`, `$post`, `$put`, `$patch`, `$delete`: bound alova methods, safe to destructure. They are lazy: `await` them, call `.send()` or pass them to a hook (`useRequest(() => $get(...))`).

Other exports: `defaultSuccessHandlers`/`defaultErrorHandlers` (frozen `readonly` arrays: spread them), `defaultAuthHandler`, `defaultErrorHandler`, `defaultJsonHandler`, `STOP_PROCESSOR`, `ResponseError`, `USE_ALOVA_KEY`, `getUseAlovaInstance()` and the types (`UseAlovaOptions`, `UseAlovaReturn`, `UseAlovaMethod`, `UseAlovaMethodConfig`, `UseAlovaResponseProcessor`, `UseAlovaResponseProcessorOptions`, `UseAlovaResponseProcessorMap`, `UseAlovaBeforeRequest`, `UseAlovaGenerics`, `OverlayOptions`).

## Errors and messages

`ResponseError` (wraps a `Response` or an `Error`) has: `status` (`0` without a response), `statusText` (may be empty on HTTP/2), `message`, `response?`, `cause?` (original error for network failures), `isAbort`, `showMessage()` (never shows aborts), `getDisplayMessage()`, `safeResponseText()`/`safeResponseJson()`/`safeResponseData()` (read from a clone, never throw) and `messageFunction`.

The core shows nothing by default: a failed request rejects with a `ResponseError`. To show errors set `errorMessageFunction`; every `autoError: false` request skips it. If the message function throws, the error is not propagated (it is logged with `debug: true`).

```ts
import { createUseAlova } from '@ilpachi/use-alova'
import { toastMessage, createToastMessage, boxMessage } from '@ilpachi/use-alova/notify'
import type { ResponseError } from '@ilpachi/use-alova'

createUseAlova({ errorMessageFunction: toastMessage })                      // toast
createUseAlova({ errorMessageFunction: boxMessage })                        // modal box
createUseAlova({ errorMessageFunction: createToastMessage({ timer: 6000 }) }) // configured toast

// For JSON APIs, write your own function:
createUseAlova({
  errorMessageFunction: async (err: ResponseError) => {
    const body = await err.safeResponseJson()
    alert(body?.detail ?? `Error ${err.status}`) // or any UI you like
  },
})
```

### Notifications (`@ilpachi/use-alova/notify`)

Dependency-free; text is always inserted with `textContent`, never as HTML.

- `toastMessage` / `boxMessage`: ready `errorMessageFunction`s. They show `Error: <status> <message>`, where the message is a plain-text body of up to 200 characters (raw JSON included, HTML bodies never), else `statusText`, else `HTTP <status>`. A network failure shows `Error: <message>`.
- `createToastMessage(options)` / `createBoxMessage(options)`: the same with `NotifyOptions`. The toast always replaces `text`; the box replaces `title` and `text`.
- `Toast.fire(options)` (returns `void`) / `Box.fire(options)` (returns `Promise<void>`), also exported as `showToast`/`showBox`, for your own notifications.
- `NotifyOptions`: `icon` (`'success' | 'error' | 'warning' | 'info' | 'question'`, default `'error'`), `title`, `text`; toast only: `timer` (ms, default `3000`, `0` = no auto-close) and `position` (default `'top-end'`); box only: `confirmButtonText` (default `'OK'`). The box closes with the button, `Escape` or a click on the backdrop.

## Auth, CSRF and CORS

- **Authorization**: `defaultAuthHandler` sets `Authorization: <authType> <token>` using `token`, and never overwrites an existing `Authorization` header. The token goes to relative-url requests (they target `baseURL`, even a cross-origin one: the configured `baseURL` is trusted) and, for absolute urls, only to same-origin requests or origins in `authOrigins`. Urls with backslashes, control characters or leading whitespace never get it.
- **CSRF** (`@ilpachi/use-alova/csrf`): add `csrfHandler({ cookieName?, headerName? })` (defaults `'csrftoken'` / `'X-CSRFToken'`) to `beforeRequestHandlers`. It is sent only for `POST`/`PUT`/`PATCH`/`DELETE`, only to same-origin requests (never cross-origin) and only with a `document`. The header is looked up case-insensitively: an existing non-empty value (set by the caller or in `defaultHeaders`, in any spelling) is not overwritten; an empty one is replaced by the token.
- After `authHandler` and `beforeRequestHandlers` the headers are normalized case-insensitively, so exactly one value per header is sent (the last one set wins).
- **CORS**: for cross-origin cookies pass `credentials: 'include'` in the request config and enable credentials in the server's CORS policy.
- `getUseAlovaInstance()` throws `Alova instance not initialized. Please call createUseAlova first.` when no `createUseAlova` call (or plugin install) happened. The exported `useAlova` throws `useAlova is not initialized: install UseAlovaPlugin with app.use(UseAlovaPlugin, options) first.` until the plugin is installed and does not fall back to `createUseAlova` instances. Every `app.use(UseAlovaPlugin, options)` has its own instance; the exported `useAlova` and `getUseAlovaInstance()` point to the last one, so with several apps (SSR per request, micro-frontends) inject it.

```ts
import { inject } from 'vue'
import { USE_ALOVA_KEY } from '@ilpachi/use-alova'

const useAlova = inject(USE_ALOVA_KEY)! // also available as `$useAlova` in templates
const { $get } = useAlova({ url: '/items' })
```

Custom token logic (other schemes, per-request decisions) fits in `authHandler`:

```ts
createUseAlova({
  authHandler: async (method) => {
    const token = await getFreshToken()
    ;(method.config.headers as Record<string, string>).Authorization = `Token ${token}`
  },
})
```

## Pipelines

- In `successHandlers`/`errorHandlers`/`completeHandlers`, an entry receives `{ options, response, method, error, result, retry, retried }`. Return `undefined` to continue unchanged, a value to replace the current `result`, or `STOP_PROCESSOR` (also as `[value, STOP_PROCESSOR]`) to stop; returning `false` or `null` is just a result and the next handler still runs. After an error handler returns `STOP_PROCESSOR` the error is swallowed and the request resolves `null` (or the tuple value). `beforeRequestHandlers` also stops on `false`.
- An error handler that returns `STOP_PROCESSOR` swallows the error and the request resolves `null` (or the value of `[value, STOP_PROCESSOR]`). To make the request reject after doing something (log, redirect), throw the error from the handler instead: `({ error }) => { report(error); throw error }`; nothing runs after it, so put it where the default handler would otherwise be.
- `defaultErrorHandler` rethrows, so custom entries must go BEFORE the defaults (`[custom, ...defaultErrorHandlers]`), otherwise they never run. The same goes for `defaultSuccessHandlers` (JSON/text parsing) and `fileSuccessHandlers` (blob, DOM, JSON).
- 1xx, 3xx (e.g. `304`) and other non-2xx, non-error statuses resolve `null`, and so does `errorHandlers: []`. 2xx bodies are parsed as JSON, then as text; an empty body (including `204`/`205`) is `null`.
- Raw bodies: `URLSearchParams`, `Blob`, `ArrayBuffer` and `ReadableStream` get the matching `Content-Type` unless you set it (alova would force JSON); `FormData`, plain objects and strings are untouched.

```ts
import { createUseAlova, defaultErrorHandlers, STOP_PROCESSOR } from '@ilpachi/use-alova'

export const useApi = createUseAlova({
  errorHandlers: [
    {
      '404': () => STOP_PROCESSOR,                                        // no message, resolves null
      '401,403': () => { location.assign('/login'); return STOP_PROCESSOR },
    },
    ...defaultErrorHandlers,                                              // the rest: message + rethrow
  ],
})
```

### Envelopes (`unwrapEnvelope`)

With `unwrapEnvelope: true` a 2xx JSON response shaped `{ success: boolean, message?, data }` resolves with just `data` (whatever it is, including `null`). JSON that does not have a boolean `success` and a `data` key (for example `{ access_token }`), arrays and text pass through unchanged, and so does every error body. Override it per request with `{ unwrapEnvelope: false }` (or `true`).

By default a 2xx envelope with `success: false` resolves with its `data` too. With `envelopeErrors: 'throw'` (global option or per-request config, only meaningful together with `unwrapEnvelope`) it rejects instead: the error is a `ResponseError` with the status of the response (for example `200`), `message` taken from the envelope `message` when it is a non-empty string (else the status text), and the envelope readable with `safeResponseJson()` / `response` (a copy, so the body is not consumed). It goes through the error pipeline like any other error: `errorHandlers` maps by status (`'2xx'`, `'200'`), `autoError` / `errorMessageFunction`, `retry()`; the overlay is released before the handlers run.

```ts
createUseAlova({ unwrapEnvelope: true, envelopeErrors: 'throw', errorMessageFunction: toastMessage })
// per request: $get('/x', { envelopeErrors: 'data' })
```

### Retry (`retry()`)

Every pipeline entry receives `retry()`: it sends the same request again, once, and resolves with the result of that second request (which goes through the whole pipeline). The headers are rebuilt from the ones you set, so `authHandler` picks up a refreshed token. If the request was already retried, `retry()` rejects with the error instead of looping; `retried` tells you that, so you can fall through to the next handlers. Refreshing the token (and making concurrent 401s share one refresh) is the app's job:

```ts
let refreshing: Promise<void> | null = null
const refreshToken = () => (refreshing ??= doRefresh().finally(() => { refreshing = null })) // your single-flight refresh

export const useApi = createUseAlova({
  baseURL: '/api',
  token: () => userStore.token,
  errorHandlers: [
    {
      '401': async ({ retry, retried }) => {
        if (retried) return undefined            // second 401: next handlers (message + rethrow)
        await refreshToken()                     // throws -> the request rejects with that error
        return [await retry(), STOP_PROCESSOR]   // resolve with the result of the retried request
      },
    },
    ...defaultErrorHandlers,
  ],
})
```

A `ReadableStream` body cannot be sent twice. Aborting works across the retry: if the caller aborts (`method.abort()`, the `abort` of a hook, or the `AbortSignal` of the config) while your handler is busy, `retry()` sends nothing and rejects with a `ResponseError` whose `isAbort` is `true` (it is never shown); if the abort happens while the retried request is running, that request is aborted and the error is an abort too.

## Overlay

The core has no overlay of its own: the `overlay` option takes an adapter `{ mode?, delay?, show?, hide? }` and does the bookkeeping.

- Requests served from alova's cache (or sharing an in-flight identical request) never touch the overlay: it is acquired when the request really goes to the network, and `delay` is counted from that moment. A `send(true)` (forced) request does go to the network.
- `show()` is called when the first request that wants the overlay is sent, `hide()` when the last one ends (success, error or abort): concurrent requests share one overlay (reference counted). `hide()` runs before the error handlers, so they can open dialogs the overlay would cover.
- `mode: 'manual'` (default): only requests with `showOverlay: true` show it. `mode: 'auto'`: every request shows it, except those with `showOverlay: false`.
- `delay` (ms, default `0`): wait before calling `show()`. A request that ends sooner shows nothing, so fast responses do not flicker.
- Without `show`/`hide` nothing is shown. An exception thrown by the adapter is logged and never breaks the request.

`@ilpachi/use-alova/overlay` provides a ready, dependency-free DOM overlay:

```ts
import { domOverlay } from '@ilpachi/use-alova/overlay'

createUseAlova({ overlay: domOverlay({ mode: 'auto', delay: 200 }) })
createUseAlova({ overlay: domOverlay({ spinner: () => document.createTextNode('Loading...') }) }) // custom content
```

`domOverlay` appends `<div id="use-alova-overlay" role="status">` with a `div.use-alova-spinner` to `document.body` and injects its CSS once (`<style id="pachi-overlay-style">`); import `@ilpachi/use-alova/styles` only if you prefer the CSS as a file. It does nothing without a `document` (SSR). To use your own UI library, pass your functions: `overlay: { mode: 'auto', delay: 150, show: () => Loading.show(), hide: () => Loading.hide() }`. The per-request `showOverlay` is a boolean only; a custom spinner is configured on the adapter.

## Files (`@ilpachi/use-alova/files`)

```ts
import { createUseAlova } from '@ilpachi/use-alova'
import { fileSuccessHandlers, withFiles } from '@ilpachi/use-alova/files'

const useApi = createUseAlova({ baseURL: '/api', successHandlers: fileSuccessHandlers })
const { $get, $download, $jdownload, $form, $upload } = withFiles(useApi({ url: '/files' }))
declare const file: File
declare const more: File[]

await $download('/report', { fileName: 'report.pdf' })           // GET, saves the file
await $jdownload('/export', { id: 1 })                           // POST, saves the file
await $form('/submit', { tags: ['a', 'b'], name: 'Ada' })        // x-www-form-urlencoded
await $upload('/upload', file)                                   // multipart, field "file"
await $upload('/upload', more, { tag: 'x' }, { fieldName: 'docs' })
```

`withFiles(api)` returns everything in `api` plus the four helpers (all bound, safe to destructure). `$download` and `$jdownload` need `blobHandler` in `successHandlers` (`fileSuccessHandlers` is `[blobHandler, domHandler, defaultJsonHandler]`, the 1.x behavior): without it they reject with a clear `TypeError` instead of saving garbage.

- `$download(url, config?)`, `$jdownload(url, data?, config?)`: GET / POST that send immediately, save the file (browser only) and resolve to the `BlobResponse` (`null` if an error handler swallowed the error).
- `$form(url, data?, config?)`: POST `application/x-www-form-urlencoded` (`Content-Type` is forced), lazy like `$post`. `data` may be an object (arrays become repeated keys, `Date` an ISO string, other objects a JSON string, `null`/`undefined` skipped, `false`/`0` become `'false'`/`'0'`), a string, `URLSearchParams` or a `FormData` with string entries only (repeated keys are kept; a `File`/`Blob` entry throws a synchronous `TypeError('$form cannot send files, use $upload')`).
- `$upload(url, files, data?, config?)`: POST multipart, a `File | Blob` or an array of them (a nameless `Blob` is sent with the file name `blob`), lazy like `$post`; never set `Content-Type` by hand. Extra `data` follows the `$form` rules, Blobs are kept.

A successful response becomes `{ fileName, data }` (`data` is a `Promise<Blob>`) when `blobHandler` runs and it has a `Content-Disposition` header, or the request config has `fileName`, or the request is `$download`/`$jdownload`; the other handlers then do not run. Only `$download`/`$jdownload` save the file; with `$get`/`$post` you just get the object. The name comes from `Content-Disposition` (`filename*` UTF-8/ISO-8859-1 supported), else `fileName`, else `'file.pdf'`, and is always sanitized (last path segment, no control characters or `\ / : * ? " < > |`, no leading/trailing dots or spaces). `domHandler` turns `text/html` responses into a `Document` when `DOMParser` exists.

## Backend contract

`use-alova` is backend-agnostic; the defaults and options fit APIs shaped like this:

- **Envelope**: successful JSON `{ "success": true, "message": "...", "data": ... }`. With `unwrapEnvelope: true` the request resolves with `data` only; with `envelopeErrors: 'throw'` a 2xx `success: false` envelope rejects with a `ResponseError`.
- **No content**: `DELETE` answering `204` (any empty 2xx body) resolves `null`.
- **Errors**: a validation error such as `{ "detail": [{ "loc": [], "msg": "", "type": "", "code": "", "params": {} }] }` is not interpreted by the core; read it with `err.safeResponseJson()` in your `errorMessageFunction` and translate `code` yourself (for example with the i18n key `errors.codes.<code>`).
- **Authentication**: `Authorization: <authType> <token>`; refresh on `401` with `retry()` (see "Retry"). Pagination and WebSocket tickets are outside the scope of this package (use `usePagination` from `alova/client`).

## Troubleshooting

- **Nothing is sent**: alova Methods are lazy. `$get`/`$post`/`$put`/`$patch`/`$delete`/`$form`/`$upload` return a Method that does nothing until you `await` it, call `.send()` or pass it to a hook; `$download`/`$jdownload` start immediately.
- **Errors show nothing**: the core has no UI; set `errorMessageFunction` (for example `toastMessage` from `@ilpachi/use-alova/notify`).
- **Stale GET data**: alova caches GET responses (5 minutes); use `cacheFor: 0` on a request to bypass, or `cacheFor: null` in the options to disable the cache.
- **Unhandled rejection**: with `useRequest` and friends, errors that are rethrown reach alova's hook machinery; that is alova's behavior (use `onError` or `autoError: false` with `.catch`).
- **Overlay not showing**: pass an `overlay` (for example `domOverlay()`), then set `showOverlay: true` on the request or use `mode: 'auto'`; with a `delay`, requests shorter than the delay never show it, and cache hits never do.
- **`$download` rejects with "add blobHandler"**: add `successHandlers: fileSuccessHandlers` (or `blobHandler`) to the options.
- **Cookies/CSRF not sent to another origin**: see "Auth, CSRF and CORS".
- **SSR**: the overlay, notifications, `getCookie` and the DOM helpers are no-ops without `document`; saving a download needs a browser.

## Migration from 1.x

Version 2.0 splits the package: the core is small and has no UI, the rest moved to opt-in subpaths. The request/response behavior and the security rules are unchanged.

| 1.x | 2.0 |
| --- | --- |
| `errorMessageFunction: 'toast'` / `'box'` (the default was `'toast'`) | `errorMessageFunction: toastMessage` / `boxMessage` from `/notify`; the core default shows nothing |
| `notifyOptions` | `createToastMessage(options)` / `createBoxMessage(options)` |
| `import { Toast, Box, showToast, showBox } from '@ilpachi/use-alova'` | same names from `@ilpachi/use-alova/notify` |
| `spinner` (option) and `showOverlay: true \| Component` | `overlay: domOverlay(...)` from `/overlay` (or `{ show, hide }`); `showOverlay` is a boolean |
| overlay only with `showOverlay: true` | still the default (`mode: 'manual'`); `mode: 'auto'` and `delay` are new |
| `cursorLoading` | removed (the `cursor-loading` class and CSS are gone) |
| `.default-spinner` CSS class | `.use-alova-spinner` |
| `store` + `storeKey` | `token: () => store.<key>` (a string or an async function also work) |
| `defaultAuthType: 'Bearer' \| 'Token'` | `authType: string` |
| CSRF built in (`csrfCookieName`, `csrfHeaderName`, `csrfTokenHandler`) | `beforeRequestHandlers: [csrfHandler({ cookieName, headerName })]` from `/csrf` (no CSRF by default) |
| `auto_error`, `csrf_cookie_name`, `csrf_header_name` | removed (use `autoError`, `csrfHandler` options) |
| `$download`, `$jdownload`, `$form`, `$upload` on the result of `useAlova()`; `alova.Download/JDownload/Form/Upload` | `withFiles(useAlova())` from `/files` (the `alova.*` extensions are gone) |
| default `successHandlers` = blob, DOM, JSON | `defaultSuccessHandlers` = JSON only; for the old behavior use `successHandlers: fileSuccessHandlers` |
| `defaultBlobHandler`, `defaultDomHandler` | `blobHandler`, `domHandler` from `/files` |
| `defaultCsrfHandler` | `csrfHandler()` from `/csrf` |
| `getCookie`, `setCookie` | `getCookie` from `/csrf`; `setCookie` removed |
| `useRequest`, `usePagination`, `useWatcher`, `useUploader` from `useAlova()` | import them from `alova/client` |
| `responded` | removed (the built-in `onSuccess`/`onError`/`onComplete` and the overlay bookkeeping always run); use the pipelines |
| `defaultCompleteHandlers` | removed (it was `[]`) |
| `beforeRequestHandlers: ['stop']` | use `STOP_PROCESSOR` (or return `false`) |
| `null` accepted by every option type | the types no longer include `null` (except `authHandler: null`); at runtime `null` pipelines still mean `[]` |
| types `AlovaExt`, `AlovaParams`, `BlobResponse`, `CreateUseAlova`, `UseAlovaRequestHandler`, `UseAlovaTokenStore`, `UseAlovaResponseProcessorEntry`/`Set`, `ResponseCodeKey` | removed or moved (`BlobResponse` is exported by `/files`) |
| - | new: `unwrapEnvelope`/`envelopeErrors`, `retry()`/`retried` in the pipelines, `overlay.mode`/`overlay.delay` |

Minimal "same as 1.x" setup:

```ts
import { createUseAlova } from '@ilpachi/use-alova'
import { toastMessage } from '@ilpachi/use-alova/notify'
import { domOverlay } from '@ilpachi/use-alova/overlay'
import { csrfHandler } from '@ilpachi/use-alova/csrf'
import { fileSuccessHandlers, withFiles } from '@ilpachi/use-alova/files'

const useApi = createUseAlova({
  baseURL: '/api',
  token: () => store.token,
  errorMessageFunction: toastMessage,
  overlay: domOverlay(),
  beforeRequestHandlers: [csrfHandler()],
  successHandlers: fileSuccessHandlers,
})
const { $get, $download } = withFiles(useApi())
```

## Contributing, security, license

Guides in Markdown (MkDocs-compatible, with `mkdocs.yml`) are in the `docs/` folder of the repository; they are not part of the npm package. See `CONTRIBUTING.md` and `SECURITY.md` in the repository too. See `CHANGELOG.md` for the release history. Released under the MIT license (see `LICENSE`).
