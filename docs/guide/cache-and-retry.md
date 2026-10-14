# Cache and retry

## Cache

alova caches GET responses for 5 minutes by default. The `cacheFor` option is passed to alova:

```ts
createUseAlova({ cacheFor: { GET: null } })   // disable the GET cache
createUseAlova({ cacheFor: null })            // disable it for every method
$get('/x', { cacheFor: 0 })                   // bypass for one request
```

Requests served from the cache never touch the overlay.

## Retry

Every pipeline entry receives `retry()` and `retried`. `retry()` sends the same request again, once,
rebuilding the headers (so `authHandler` picks up a refreshed token), and resolves with the result of
the second request, which goes through the whole pipeline again. If the request was already retried
it rejects: check `retried` first.

```ts
let refreshing: Promise<void> | null = null
const refreshToken = () => (refreshing ??= doRefresh().finally(() => { refreshing = null }))

export const useApi = createUseAlova({
  baseURL: '/api',
  token: () => userStore.token,
  errorHandlers: [
    {
      '401': async ({ retry, retried }) => {
        if (retried) return undefined
        await refreshToken()
        return [await retry(), STOP_PROCESSOR]
      },
    },
    ...defaultErrorHandlers,
  ],
})
```

Single-flight refresh is the app's job. A `ReadableStream` body cannot be sent twice. If the caller
aborts while the handler works, `retry()` rejects with a `ResponseError` whose `isAbort` is `true`.
