# Getting started

## Install

```bash
pnpm add @ilpachi/use-alova   # peer dependencies: vue ^3, alova ^3.3.0
```

Requires Node >= 20. Recommended `tsconfig.json` settings:

```json
{ "compilerOptions": { "moduleResolution": "bundler", "skipLibCheck": true } }
```

## Install the plugin

```ts
import { createApp } from 'vue'
import { UseAlovaPlugin } from '@ilpachi/use-alova'
import { toastMessage } from '@ilpachi/use-alova/notify'
import { domOverlay } from '@ilpachi/use-alova/overlay'
import { csrfHandler } from '@ilpachi/use-alova/csrf'
import App from './App.vue'

const app = createApp(App)
app.use(UseAlovaPlugin, {
  baseURL: '/api',
  token: () => localStorage.getItem('token'),  // called for every request
  errorMessageFunction: toastMessage,
  overlay: domOverlay({ delay: 200 }),
  beforeRequestHandlers: [csrfHandler()],
})
app.mount('#app')
```

## Make requests

```vue
<script setup lang="ts">
import { useRequest } from 'alova/client'
import { useAlova } from '@ilpachi/use-alova'

const { $get } = useAlova({ url: '/items' })   // requests go to /api/items/...
const { data, loading } = useRequest(() => $get('/list', { showOverlay: true }), { immediate: true })
</script>
```

`$get`, `$post`, `$put`, `$patch` and `$delete` return lazy alova methods: `await` them, call `.send()`
or pass them to a hook from `alova/client`. `useAlova({ url })` is memoized per `url`: do not pass
dynamic values, pass them per request.

## Without Vue

```ts
import { createUseAlova } from '@ilpachi/use-alova'

export const useApi = createUseAlova({ baseURL: '/api' })
const { $post } = useApi({ url: '/users' })
await $post('/', { name: 'Ada' })
```

## Per-request configuration

| Field | Effect |
| --- | --- |
| `autoError: false` | rethrow without calling `errorMessageFunction` |
| `showOverlay: true / false` | force or suppress the overlay |
| `unwrapEnvelope`, `envelopeErrors` | override the global option |
| `fileName`, `fieldName` | used by `./files` |
| `meta: { autoError, spinner }` | boolean aliases of `autoError` and `showOverlay` |
