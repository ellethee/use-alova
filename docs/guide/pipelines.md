# Pipelines and handlers

Order of a request: `authHandler` -> `beforeRequestHandlers` -> network -> `successHandlers` (2xx) or
`errorHandlers` (errors) -> `completeHandlers`.

An entry receives `{ options, response, method, error, result, retry, retried }`.

| Return value | Effect |
| --- | --- |
| `undefined` | continue, `result` unchanged |
| any value (also `false`, `null`) | replaces `result`, the next entry still runs |
| `STOP_PROCESSOR` | stop; in an error pipeline the error is swallowed and the request resolves `null` |
| `[value, STOP_PROCESSOR]` | stop with `value` |

Entries can also be maps keyed by status: `'404'`, `'4xx'`, `'401,403'`, `'2xx,404'`.

```ts
import { createUseAlova, defaultErrorHandlers, STOP_PROCESSOR } from '@ilpachi/use-alova'

export const useApi = createUseAlova({
  errorHandlers: [
    {
      '404': () => STOP_PROCESSOR,
      '401,403': () => { location.assign('/login'); return STOP_PROCESSOR },
    },
    ...defaultErrorHandlers,   // message + rethrow: custom entries must come BEFORE
  ],
})
```

To make the request reject after doing something, throw the error from the handler instead of
returning `STOP_PROCESSOR`: `({ error }) => { report(error); throw error }`.

Defaults: `defaultSuccessHandlers` (JSON, then text; empty body, including 204/205, is `null`),
`defaultErrorHandlers` (shows the message when `errorMessageFunction` is set, then rethrows).
1xx, 3xx and other non-2xx, non-error statuses resolve `null`. `null` pipelines mean `[]`.

Raw bodies (`URLSearchParams`, `Blob`, `ArrayBuffer`, `ReadableStream`) get the matching
`Content-Type` unless you set it.
