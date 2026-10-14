import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

/** Entry points: one per public subpath of `package.json#exports`. */
const entries = {
  index: 'src/index.ts',
  notify: 'src/notify/index.ts',
  overlay: 'src/overlay/index.ts',
  files: 'src/files/index.ts',
  csrf: 'src/csrf/index.ts',
}

export default defineConfig({
  plugins: [
    dts({
      bundleTypes: { invokeOptions: { typescriptCompilerFolder: undefined } },
      entryRoot: 'src',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-utils/**'],
    }),
  ],
  build: {
    // Readable class/function names and stack traces for consumers (the bundle is tiny anyway).
    minify: false,
    // No source maps on purpose: the output is not minified, so stacks already point to readable code, while
    // maps (which must embed the sources, `src` is not published) would double the tarball.
    sourcemap: false,
    lib: { entry: entries },
    rolldownOptions: {
      external: ['vue', 'alova', /^alova\//],
      // Code shared by several entries goes to `dist/chunks/` (ESM: `.js`, CommonJS: `.cjs`).
      output: [
        {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          comments: false,
        },
        {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: 'chunks/[name]-[hash].cjs',
          exports: 'named',
          comments: false,
        },
      ],
    },
  },
})
