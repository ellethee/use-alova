# Subpaths

The core never imports the subpaths: import only what you use. Each is ESM + CJS with types.

## `/notify`

Dependency-free notifications; text is always inserted with `textContent`.

```ts
import { toastMessage, boxMessage, createToastMessage } from '@ilpachi/use-alova/notify'

createUseAlova({ errorMessageFunction: toastMessage })
createUseAlova({ errorMessageFunction: boxMessage })
createUseAlova({ errorMessageFunction: createToastMessage({ timer: 6000 }) })
```

`NotifyOptions`: `icon` (`success | error | warning | info | question`, default `error`), `title`, `text`;
toast only `timer` (default `3000`, `0` = no auto-close) and `position` (default `top-end`);
box only `confirmButtonText` (default `OK`). `Toast.fire()` / `Box.fire()` (also `showToast` / `showBox`)
are available for your own notifications.

For JSON APIs write your own function and read the body with `err.safeResponseJson()`
(see [Backend contract](backend-contract.md)).

## `/overlay`

```ts
import { domOverlay } from '@ilpachi/use-alova/overlay'

createUseAlova({ overlay: domOverlay({ mode: 'auto', delay: 200 }) })
```

`mode: 'manual'` (default) shows it only for requests with `showOverlay: true`; `'auto'` for every
request except `showOverlay: false`. `delay` avoids flicker. Concurrent requests share one overlay
(reference counted). To use a UI library pass your own adapter:
`overlay: { mode: 'auto', delay: 150, show: () => Loading.show(), hide: () => Loading.hide() }`.
`import '@ilpachi/use-alova/styles'` only if you prefer the CSS as a file.

## `/files`

```ts
import { fileSuccessHandlers, withFiles } from '@ilpachi/use-alova/files'

const useApi = createUseAlova({ baseURL: '/api', successHandlers: fileSuccessHandlers })
const { $download, $jdownload, $form, $upload } = withFiles(useApi({ url: '/files' }))

await $download('/report', { fileName: 'report.pdf' })   // GET, saves the file
await $jdownload('/export', { id: 1 })                   // POST, saves the file
await $form('/submit', { name: 'Ada' })                  // x-www-form-urlencoded
await $upload('/upload', file)                           // multipart, field "file"
```

`$download` and `$jdownload` need `blobHandler` in `successHandlers`. File names come from
`Content-Disposition` (`filename*` supported), else `fileName`, else `file.pdf`, and are sanitized.

## `/csrf`

`csrfHandler({ cookieName?, headerName? })` (defaults `csrftoken` / `X-CSRFToken`) in
`beforeRequestHandlers`. It is sent only for `POST`/`PUT`/`PATCH`/`DELETE`, only same-origin.
For cross-origin cookies use `credentials: 'include'` and enable credentials in the server CORS policy.
