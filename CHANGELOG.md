# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Open-source distribution: metadata, docs and GitHub workflows.
- Build tooling: Vite 8, vite-plugin-dts 5 (and TypeScript 7).

## [2.1.1] - 2026-10-06

### Documentation

- README: registry setup, "Backend contract" section and pointers to the new guides.
- New `docs/` guides (getting started, subpaths, pipelines, cache and retry, backend contract, migration) with a Material for MkDocs configuration; not published to npm.

## [2.1.0] - 2026-10-05

Backward compatible: nothing changes unless the new options are used.

### Added

- `cacheFor` option (`Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS', number | Date | null>> | null`), passed to alova: global cache time per HTTP method. Unset keeps alova's default (GET cached for 5 minutes); `null` or `{ GET: null }` disables the cache; a request can override it with its own `cacheFor`.
- `method.meta.autoError` and `method.meta.spinner` (booleans) are read as aliases of the per-request `autoError` and `showOverlay` (the config fields win).
- `authType` also accepts a function `(method) => string | undefined` (for example the `token_type` sent by the backend); `undefined` or `''` fall back to `'Bearer'`.

### Documentation

- README: how to make a request reject after an error handler ran (throw the error: `STOP_PROCESSOR` swallows it and resolves `null`), the `meta` aliases and the new options.

## [2.0.0] - 2026-10-05

Breaking release: the package is now a small, dependency-free core with opt-in subpaths. See "Migration from 1.x" in the README for the old -> new table.

### Added

- Subpaths (ESM + CJS, with types, tree-shakable): `@ilpachi/use-alova/notify`, `/overlay`, `/files` and `/csrf` (the core never imports them; `/styles` is unchanged in name and serves `dist/overlay.css`).
  - `/notify`: `Toast`, `Box`, `showToast`, `showBox`, `NotifyOptions` and ready `errorMessageFunction`s: `toastMessage`, `boxMessage`, `createToastMessage(options)`, `createBoxMessage(options)`.
  - `/overlay`: `domOverlay({ mode?, delay?, spinner? })`, a dependency-free full-page overlay (no Vue needed) usable as the `overlay` option.
  - `/files`: `withFiles(api)` (`$download`, `$jdownload`, `$form`, `$upload`), `blobHandler`, `domHandler`, `fileSuccessHandlers`.
  - `/csrf`: `csrfHandler({ cookieName?, headerName? })` for `beforeRequestHandlers`, and `getCookie`.
- `overlay` option: `{ mode?: 'manual' | 'auto', delay?: number, show?, hide? }`. `manual` (default, as in 1.x) shows it only for requests with `showOverlay: true`; `auto` shows it for every request except `showOverlay: false`; `delay` (ms, default 0) avoids flicker on fast responses; reference counted for concurrent requests. The overlay is acquired when the request really goes to the network (through the request adapter), so alova cache hits never call `show`/`hide` and `delay` counts from the network start.
- `unwrapEnvelope` option and per-request config (default `false`): 2xx JSON responses shaped `{ success, message?, data }` resolve with just `data`; other JSON passes through unchanged. `envelopeErrors` (`'data'` default | `'throw'`, global or per request, only with `unwrapEnvelope`): with `'throw'` a 2xx envelope with `success: false` rejects with a `ResponseError` (response status, `message` from the envelope, body readable) routed through the error pipeline (status maps such as `'2xx'`, `autoError`, `retry()`).
- `retry()` and `retried` in the context of every pipeline entry: `retry()` sends the same request again once (rebuilding the headers, so `authHandler` picks up a refreshed token) and resolves with its result; documented "401 -> refresh -> retry" example. Aborting (`method.abort()`, a hook's `abort`, the config `AbortSignal`) before the retry prevents it and rejects with an abort `ResponseError`; aborting during the retried request aborts it.
- `token` and `authType` options (see Changed).
- `typesVersions`, so the subpath types also resolve with `moduleResolution: "node"`; `pnpm build` now type-checks the published declarations of all the subpaths together (`scripts/consumer-check.ts`).

### Changed

- Behavior change: the core has no UI. Without `errorMessageFunction` errors are only rethrown (1.x showed a toast by default). `errorMessageFunction` takes a function only (the strings `'toast'` and `'box'` are gone: use `toastMessage` / `boxMessage`).
- Behavior change: the default `successHandlers` only parse JSON/text. Blob and DOM handling moved to `/files` (`successHandlers: fileSuccessHandlers` restores the 1.x pipeline).
- Behavior change: CSRF is no longer built in; add `csrfHandler()` to `beforeRequestHandlers` (it runs after `authHandler`, in array order).
- `store` + `storeKey` + `defaultAuthType` are replaced by `token` (a string, or a possibly async function such as `() => userStore.token`) and `authType` (any string, default `'Bearer'`).
- `defaultAuthHandler` is asynchronous.
- `showOverlay` is a boolean per request; the custom spinner moved to the adapter (`domOverlay({ spinner })`). The spinner CSS class is now `use-alova-spinner` (was `default-spinner`) and its keyframes are `use-alova-spin`. The overlay element has `role="status"`.
- `STOP_PROCESSOR` is created with `Symbol.for('@ilpachi/use-alova:stop')`, so it is the same value even if the package is loaded twice (ESM and CJS copies). Its type stays `unique symbol`: the post-build step makes the declarations of every subpath import it from the core declarations, so types of one subpath are assignable to the others.
- `ResponseError` no longer depends on the notifications: `messageFunction` is optional, `notifyOptions` is gone and `showMessage()` does nothing without a message function.
- `$download` and `$jdownload` reject with a clear `TypeError` when the response was not handled by `blobHandler` (instead of saving the parsed body).
- Types: `null` is no longer part of the option types (except `authHandler: null`; `null` pipelines still behave like `[]` at runtime); the exported types were reduced and the sources reorganized (`src/core`, `src/notify`, `src/overlay`, `src/files`, `src/csrf`).
- Bundle size (minified + gzip, bundler output): `.` alone is about 4.6 KB (about 9.2 KB for 1.0.5, which included everything).

### Removed

- Options: `spinner`, `notifyOptions`, `csrfCookieName`, `csrfHeaderName`, `csrfTokenHandler`, `store`, `storeKey`, `defaultAuthType`, `responded`, and the deprecated aliases `auto_error`, `csrf_cookie_name`, `csrf_header_name`.
- The re-exported alova hooks `useRequest`, `usePagination`, `useWatcher`, `useUploader` (import them from `alova/client`; the package no longer imports `alova/client`).
- `cursorLoading` (per-request option, `cursor-loading` class and CSS): a progress cursor is a one-line CSS rule or a `show`/`hide` of your own overlay adapter, it did not justify code in the package.
- `setCookie` (only `getCookie` is needed by `/csrf`), `defaultCsrfHandler`, `defaultBlobHandler`, `defaultDomHandler` (now `csrfHandler`, `blobHandler`, `domHandler`), `defaultCompleteHandlers` (it was `[]`).
- The `'stop'` literal in `beforeRequestHandlers` (use `STOP_PROCESSOR` or return `false`).
- The `alova.Download/JDownload/Form/Upload` extensions and `AlovaExt`, `AlovaParams`, `CreateUseAlova`, `UseAlovaRequestHandler`, `UseAlovaTokenStore`, `UseAlovaResponseProcessorEntry`/`Set` and `ResponseCodeKey` types.

### Documentation

- README rewritten (subpaths, options with defaults, pipelines, envelopes, retry, overlay, files, troubleshooting, "Migration from 1.x"); `CONTRIBUTING.md`, `CLAUDE.md` and `SECURITY.md` aligned.

## [1.0.5] - 2026-10-02

### Fixed

- CSRF header precedence (behavior change): the lookup is case-insensitive and an existing non-empty header (set by the caller or in `defaultHeaders`, any spelling) is no longer overwritten; an empty or `null` value is replaced by the token. Before, the values were merged (`'mine, TOKEN'`).
- After `authHandler`, `csrfTokenHandler` and `beforeRequestHandlers` the headers are normalized case-insensitively, so exactly one value per header is sent (the last one set wins).
- `$form(url, FormData)` converts string entries to URL-encoded data (repeated keys kept). A `FormData` containing a `File`/`Blob` now throws a synchronous `TypeError('$form cannot send files, use $upload')` instead of sending an empty body.
- `errorMessageFunction: null` (and any invalid value) behaves like the default `'toast'`.
- `$upload` accepts `File | Blob | Array<File | Blob>` and sends a nameless `Blob` with the file name `blob` (it was `undefined`).
- `useAlova(null)` is accepted and is the same as `useAlova()` (it used to throw a `TypeError`).
- The `Escape` key listener of the notification box removes itself on the next key press if the box was detached from the DOM by other code.

### Changed

- Types widened with `null`: `defaultHeaders`, `responded`, `authOrigins`, `notifyOptions` and `errorMessageFunction` (in addition to `spinner`, `store`, `storeKey`, the handlers); `null` is also tolerated at runtime for every other option.
- Integration tests: `src/integration.test.ts` runs against a real local HTTP server (`src/test-utils/`), without a `fetch` mock.
- CI release hardening: the release job requires the tag to match the `package.json` version, a `## [x.y.z]` section in `CHANGELOG.md` and the tagged commit to be on `main`; it skips the publish when the version already exists on the registry; pre-release versions are published with the `next` dist-tag; one concurrency group per ref; job timeouts; pinned tool versions; `pnpm audit` is informational (non blocking).

### Documentation

- README restructured (install and tsconfig notes, options with `null` values, `ResponseError` members and message priority, `notifyOptions`, pipelines and custom `responded`, downloads, overlay, troubleshooting, upgrading); `SECURITY.md` and `CONTRIBUTING.md` (real release flow) corrected; US spelling.

## [1.0.4] - 2026-10-01

### Changed

- The README is now the single reference: it contains the options table, the per-request config, the returned methods and the behavior notes.

### Removed

- The hand-written `docs/` folder (`index.md`, `Examples.md`, `API/Base.md`); it will be rewritten in the future. `pnpm docs:api` still generates the TypeDoc reference into `docs/api` (not versioned).
- The `dev` script (the package is a library build, there is no page to serve).

### Internal

- Refactors and cleanups with no behavior change: removed the `isObjectEmpty` helper, extracted helpers, simplified the lint configuration, added tests.

## [1.0.3] - 2026-10-01

### Added

- `repository`, `homepage` and `bugs` fields in `package.json`; security contact in `SECURITY.md`.
- `autoError`, `csrfCookieName` and `csrfHeaderName` options (camelCase, consistent with the rest of the options). Resolution is `camelCase ?? snake_case ?? default`.
- Precise types: `spinner?: boolean | Component | null` and `store?: UseAlovaTokenStore | null` (a function `(method, options) => string | null | undefined` or an object such as a Pinia store); the new `UseAlovaTokenStore` type is exported.
- The loading overlay injects its own stylesheet at runtime (single `<style id="pachi-overlay-style">`, idempotent, nothing on the server), like `Toast`/`Box`: `import '@ilpachi/use-alova/styles'` is now optional.
- The bundle is no longer minified, so class/function names and stack traces stay readable (no source maps are published: they would double the package size and are unnecessary for unminified code).
- Documentation: `TypeScript` note (`moduleResolution: "bundler"`), `Types` section in the API docs (the hand-written API docs were removed in 1.0.4), per-app plugin instances.

### Changed

- Behavior change: `UseAlovaPlugin` creates its own `useAlova` instance for every `app.use(...)`, and provides it (`USE_ALOVA_KEY`) and exposes it (`$useAlova`) per app: several apps (SSR per request, micro-frontends) no longer override each other. The exported `useAlova` and `getUseAlovaInstance()` remain module-level singletons and point to the last installed plugin/factory (as before).
- Behavior change: `defaultErrorHandlers`, `defaultSuccessHandlers` and `defaultCompleteHandlers` are frozen and typed `readonly UseAlovaResponseProcessor[]`: `defaultErrorHandlers.push(...)` now throws instead of silently changing the defaults of every instance. Spread them into a new array (`[custom, ...defaultErrorHandlers]`); the handler options accept readonly arrays.
- Behavior change: alova's `[HitCache]` console message on every GET cache hit is now silent unless `debug` is `true` (`cacheLogger` follows `debug`).
- Behavior change: file names from the server or from `fileName` are sanitized before saving; `setCookie` throws on invalid input instead of silently failing.
- `dist/index.css` is generated from the same source as the runtime-injected overlay styles (identical rules); `import '@ilpachi/use-alova/styles'` keeps working.
- Documentation: options tables use the camelCase names; removed the stale claim that `$download`/`$jdownload` use `responseType: 'blob'` (they use `meta.useAlovaDownload` and `response.blob()`); documented the pipeline gotchas (custom entries after the default blob/DOM/error handlers never run; 1xx/3xx/`304` and `errorHandlers: []` resolve `null` silently), that an absolute cross-origin `baseURL` still receives `Authorization` for relative urls by design while CSRF does not, and the file name sanitization.
- Documentation: the `autoError: false` example compiles (`satisfies UseAlovaMethodConfig & { params: ... }`); JSDoc in the published typings refers to `@ilpachi/use-alova` and `createUseAlova` instead of internal paths.
- `sanitizeFileName` is a new internal helper (`utils/blobutils`), not part of the public API.

### Deprecated

- `auto_error`, `csrf_cookie_name` and `csrf_header_name`: use `autoError`, `csrfCookieName` and `csrfHeaderName`. The old names keep working (the camelCase name wins when both are set); with `debug: true` a one-time `console.warn` reports their use.

### Fixed

- `defaultHeaders` and request headers are merged case-insensitively (the request wins and keeps its spelling): `Authorization` + `authorization` no longer reach the server as `Bearer D, Bearer M`.
- `Content-Disposition`: parameter names are matched only at the start of a parameter (`name="filename=zz"` no longer yields a bogus name), quoted strings with escapes are honored, `filename*` is preferred over `filename` and supports UTF-8 and ISO-8859-1.
- `setCookie` throws a clear `Error` for an invalid `expires` (it used to write `Invalid Date` and the cookie was silently dropped) and for `path`/`domain`/`sameSite` values containing `;`, CR or LF.
- Notifications: text/background contrast reaches WCAG AA (4.5:1) for all five icon types; `prefers-color-scheme: dark` is respected by toasts and box; on viewports <= 480px the toast container uses the full width (12px margins); the box accent is an inset shadow that follows the corner curvature cleanly.
- Someone forgetting `import '@ilpachi/use-alova/styles'` no longer gets an unstyled overlay.

### Security

- `Authorization` and CSRF tokens were sent to a foreign host when the `baseURL` was empty and the url contained backslashes or tab/newline/control characters (`\\evil.com`, `/\evil.com`, `/\t/evil.com`, `\t//evil.com`): they were judged same-origin but alova and browsers resolve them elsewhere. The decision is now made on the final url built like alova builds it and resolved like the browser does, and urls with backslashes, control characters or leading whitespace never receive a token.
- `parseContentDispositionFileName` no longer uses backtracking regular expressions (ReDoS: a crafted header blocked the main thread for seconds); it is a linear scanner and ignores anything beyond 4 KB.
- Download file names are sanitized (last path segment only, no control characters or `\ / : * ? " < > |`, no leading/trailing dots or spaces) for `Content-Disposition`, `filename*` and the `fileName` option.
- The shared default handler arrays can no longer be mutated by a consumer (see `Changed`).

## [1.0.2] - 2026-10-01

### Added

- Typed per-request config fields (`UseAlovaMethodConfig` applied to `$get`/`$post`/... and handler method types): `autoError`, `showOverlay`, `cursorLoading`, `fileName` and `fieldName` are type-checked and auto-completed, also on `method.config` inside the handlers.
- Exported `UseAlovaMethod` type (`Method<UseAlovaGenerics>`), used as the `method` type of the handlers.

### Changed

- `showOverlay` is typed as `boolean | Component`.
- Type-only: no runtime change.

## [1.0.1] - 2026-10-01

### Added

- `authOrigins` option: extra origins allowed to receive the `Authorization` header.
- Exports `USE_ALOVA_KEY`, `UseAlovaHook` and `UseAlovaGenerics`.
- Real HTTP integration tests (local server, no fetch mocks).
- `SECURITY.md` and `CONTRIBUTING.md`.

### Changed

- Documentation rewritten: options table with defaults, valid TypeScript signatures, plain GitHub markdown, compilable examples, notes on GET caching (`cacheFor`) and on `useAlova({ url })` memoization.
- `alova` peer dependency raised to `^3.3.0` (first release with `useUploader`); `alova` and `vue` added to `devDependencies`.
- `pnpm typecheck` also checks the tests; removed the unused Vue eslint plugin and parser.
- The built-in error toast shows `statusText` (fallback `HTTP <status>`) or a short plain-text body (max 200 characters); HTML bodies are never shown.

### Fixed

- `$get`/`$post`/`$put`/`$patch`/`$delete` are bound and can be destructured safely.
- `$download`/`$jdownload` now work with the default handlers; the file name defaults to `'file.pdf'` when there is no `Content-Disposition` and no `fileName`, and errors while saving the file reject the returned promise.
- `spinner: true` now enables the built-in spinner; with a custom `responded` the overlay is still hidden automatically.
- `authHandler` and `csrfTokenHandler` may be async.

### Security

- The `Authorization` token is no longer sent to third-party absolute urls: relative-url requests (configured `baseURL`) still receive it, absolute urls only when same-origin or listed in `authOrigins`.

## [1.0.0] - 2026-10-01

First public release as `@ilpachi/use-alova`.

### Added

- `createUseAlova` factory and `UseAlovaPlugin` Vue plugin for alova 3.
- Reference-counted loading overlay, optional progress cursor.
- Centralized error handling with a dependency-free toast/box (`Toast`, `Box`, `showToast`, `showBox`), configurable through `errorMessageFunction` and `notifyOptions`.
- CSRF (same-origin only) and Bearer authentication handlers.
- `$download`/`$jdownload`, `$form` helpers and alova hooks bound to the instance.
- `$upload` multipart helper (single or multiple files) and `useUploader` available from `useAlova()`.
- Correct `Content-Type` for raw request bodies (`URLSearchParams`, `Blob`, `ArrayBuffer`, `ReadableStream`).
- `getCookie`/`setCookie` helpers.
- Dual ESM/CJS build with typings; overlay styles available via `@ilpachi/use-alova/styles`.
- Requires Node >= 20.

[Unreleased]: https://github.com/ellethee/use-alova/compare/v2.1.1...HEAD
[2.1.1]: https://github.com/ellethee/use-alova/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/ellethee/use-alova/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/ellethee/use-alova/compare/v1.0.5...v2.0.0
[1.0.5]: https://github.com/ellethee/use-alova/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/ellethee/use-alova/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/ellethee/use-alova/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/ellethee/use-alova/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/ellethee/use-alova/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/ellethee/use-alova/releases/tag/v1.0.0
