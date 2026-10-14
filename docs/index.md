# @ilpachi/use-alova

Vue 3 wrapper for [alova](https://alova.js.org/): a small core with token authentication, header merging,
response pipelines and centralized error handling, plus optional, tree-shakable subpaths for notifications,
a loading overlay, file helpers and CSRF. No dependencies, fully typed, ESM and CommonJS.

| Entry point | Purpose |
| --- | --- |
| `@ilpachi/use-alova` | Core: `createUseAlova`, `UseAlovaPlugin`, `useAlova`, pipelines, `ResponseError` |
| `@ilpachi/use-alova/notify` | Toast and modal box, ready `errorMessageFunction`s |
| `@ilpachi/use-alova/overlay` | Dependency-free full-page loading overlay |
| `@ilpachi/use-alova/files` | `$download`, `$jdownload`, `$form`, `$upload` |
| `@ilpachi/use-alova/csrf` | `csrfHandler`, `getCookie` |
| `@ilpachi/use-alova/styles` | Overlay CSS as a file |

Start with [Getting started](guide/getting-started.md). The full option reference lives in the
repository `README.md`; the generated API reference is produced with `pnpm docs:api`.
