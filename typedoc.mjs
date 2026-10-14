/** @type {Partial<import("typedoc").TypeDocOptions>} */
const config = {
  entryPoints: [
    'src/index.ts',
    'src/notify/index.ts',
    'src/overlay/index.ts',
    'src/files/index.ts',
    'src/csrf/index.ts',
  ],
  plugin: ['typedoc-plugin-markdown'],
  out: 'docs/api',
  excludePrivate: true,
  excludeInternal: true,
  excludeProtected: true,
  readme: 'none',
  includeVersion: true,
  disableSources: true,
  entryFileName: 'index',
  hideBreadcrumbs: true,
}
export default config
