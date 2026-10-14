# Backend contract

`use-alova` is backend-agnostic, but its defaults fit APIs shaped like this.

## Envelope

Successful JSON responses `{ "success": true, "message": "...", "data": ... }`. With
`unwrapEnvelope: true` the request resolves with just `data`. JSON without a boolean `success` and a
`data` key (for example `{ "access_token": "..." }`), arrays, text and error bodies are untouched.
With `envelopeErrors: 'throw'` a 2xx envelope with `success: false` rejects with a `ResponseError`
(same status, `message` from the envelope) that goes through the error pipeline.

## DELETE and empty bodies

`DELETE` answering `204 No Content` (or any empty 2xx body) resolves `null`.

## Error body

Typical validation error: `{ "detail": [ { "loc": [...], "msg": "...", "type": "...", "code": "...", "params": {} } ] }`.
The core does not interpret it: read it in your own `errorMessageFunction` (for example translating
`code` with your i18n keys such as `errors.codes.<code>`):

```ts
createUseAlova({
  errorMessageFunction: async (err) => {
    const body = await err.safeResponseJson()
    const first = Array.isArray(body?.detail) ? body.detail[0] : undefined
    notify(first ? translate(`errors.codes.${first.code}`, first.params) : err.getDisplayMessage())
  },
})
```

## Authentication

`token` and `authType` feed `Authorization: <authType> <token>`; the token is sent only to `baseURL`
requests, same-origin absolute URLs and origins in `authOrigins`. Refresh on 401: see
[Cache and retry](cache-and-retry.md). Pagination and WebSocket tickets are not handled by this
package (use the alova hooks, such as `usePagination`, from `alova/client`).
