import { createApp, defineComponent, h, inject } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { getUseAlovaInstance } from './create'
import { USE_ALOVA_KEY, UseAlovaPlugin, useAlova } from './plugin'
import type { UseAlovaHook } from './plugin'

/** Mounts an app with the plugin and returns the hook injected in a child component and `$useAlova`. */
function mountApp(baseURL: string): {
  injected: UseAlovaHook | undefined
  global: UseAlovaHook | undefined
} {
  const out: { injected: UseAlovaHook | undefined; global: UseAlovaHook | undefined } = {
    injected: undefined,
    global: undefined,
  }
  const Child = defineComponent({
    setup() {
      out.injected = inject(USE_ALOVA_KEY)
      return () => h('i')
    },
    mounted() {
      out.global = (this as unknown as { $useAlova: UseAlovaHook }).$useAlova
    },
  })
  const app = createApp(Child)
  app.use(UseAlovaPlugin, { baseURL })
  app.mount(document.createElement('div'))
  return out
}

describe('UseAlovaPlugin', () => {
  it('gives every app its own instance (provide and $useAlova)', () => {
    const a = mountApp('/a')
    const b = mountApp('/b')
    expect(a.injected).toBeTypeOf('function')
    expect(a.injected).not.toBe(b.injected)
    expect(a.global).toBe(a.injected)
    expect(b.global).toBe(b.injected)
    expect(a.injected!().alova.options.baseURL).toBe('/a')
    expect(b.injected!().alova.options.baseURL).toBe('/b')
    expect(a.injected!().useAlovaOptions.baseURL).toBe('/a')
  })
  it('the exported useAlova and getUseAlovaInstance follow the last installed plugin (backward compatible)', () => {
    mountApp('/first')
    const last = mountApp('/last')
    expect(useAlova().alova.options.baseURL).toBe('/last')
    expect(useAlova().alova).toBe(last.injected!().alova)
    expect(getUseAlovaInstance()().alova).toBe(last.injected!().alova)
  })
})

describe('useAlova helper without plugin', () => {
  it('throws when the plugin has not been installed', async () => {
    vi.resetModules()
    const fresh = await import('./plugin')
    expect(() => fresh.useAlova()).toThrow('not initialized')
  })
})
