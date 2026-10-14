import { createUseAlova } from './create'
import type { App, InjectionKey, Plugin } from 'vue'
import type { UseAlovaOptions, UseAlovaReturn } from './types'

/** Type of the `useAlova` hook provided by the plugin. */
export type UseAlovaHook = (params?: { url?: string } | null) => UseAlovaReturn

/**
 * Typed injection key under which `UseAlovaPlugin` provides the `useAlova` hook
 * (`inject(USE_ALOVA_KEY)`). It is the string `'useAlova'` at runtime, so `inject('useAlova')` still works.
 */
export const USE_ALOVA_KEY = 'useAlova' as unknown as InjectionKey<UseAlovaHook>

declare module 'vue' {
  interface ComponentCustomProperties {
    /** The `useAlova` hook installed by `UseAlovaPlugin`. */
    $useAlova: UseAlovaHook
  }
}

/** Hook of the last `app.use(UseAlovaPlugin)` call: backs the exported `useAlova` helper only. */
let installed: UseAlovaHook | null = null

/**
 * Hook installed by the last `app.use(UseAlovaPlugin, options)`, preconfigured with those options.
 * It is a module-level singleton (backward compatible): with several apps (SSR per request, micro-frontends)
 * the last installed plugin wins here, so inside components prefer `inject(USE_ALOVA_KEY)` or
 * `$useAlova`, which are bound to their own app.
 * Throws a clear error if the plugin has not been installed yet.
 *
 * @param params - Optional parameters (`{ url }`).
 * @returns The `useAlova` result (alova instance and helpers).
 */
const useAlova: UseAlovaHook = params => {
  if (!installed) {
    throw new Error(
      'useAlova is not initialized: install UseAlovaPlugin with app.use(UseAlovaPlugin, options) first.'
    )
  }
  return installed(params)
}

/**
 * Vue plugin to integrate the useAlova composable into a Vue application.
 *
 * @remarks
 * Every `app.use(UseAlovaPlugin, options)` creates its own `useAlova` instance (own alova instances and
 * options), exposed through `app.config.globalProperties.$useAlova` and through Vue's dependency injection
 * with the key `USE_ALOVA_KEY` (the string `'useAlova'`): several apps never share or override each other's
 * configuration. The exported `useAlova` function (and `getUseAlovaInstance`) instead point to the instance
 * of the last installed plugin.
 *
 * @example
 * ```typescript
 * import { createApp } from 'vue';
 * import { UseAlovaPlugin } from '@ilpachi/use-alova';
 *
 * const app = createApp(App);
 * app.use(UseAlovaPlugin, {  options  });
 * ```
 *
 * @param app - The Vue application instance.
 * @param options - Configuration options to initialize useAlova.
 */
const UseAlovaPlugin: Plugin = {
  install(app: App, options: UseAlovaOptions) {
    const instance = createUseAlova(options)
    installed = instance
    app.config.globalProperties.$useAlova = instance
    app.provide(USE_ALOVA_KEY, instance)
  },
}
export { useAlova, UseAlovaPlugin }
