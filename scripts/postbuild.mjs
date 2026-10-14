// Post-build step:
// - `dist/<entry>.d.cts`: the same (self-contained) declarations as `dist/<entry>.d.ts`, for CommonJS consumers.
// - `dist/styles.d.ts` / `dist/styles.d.cts`: empty declaration so `import '@ilpachi/use-alova/styles'` type-checks.
// - `dist/overlay.css`: overlay stylesheet (`@ilpachi/use-alova/styles`), generated from the same source
//   (`src/overlay/styles.ts`) that the runtime injects, so the two can never diverge.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
// TypeScript 7 has no JS API: the TS 6 fallback (also needed by vite-plugin-dts) is used to transpile `styles.ts`.
import ts from '@typescript/typescript6'

// `STOP_PROCESSOR` is a `unique symbol`, which is nominal: every rolled-up declaration file of a subpath would
// declare its own, and types of one entry point would not be assignable to those of another. The subpath
// declarations therefore import the one of the core (type-only: it is only used in `typeof` positions).
for (const file of ['notify', 'overlay', 'files', 'csrf']) {
  const path = `dist/${file}.d.ts`
  let text = readFileSync(path, 'utf8')
  const declaration =
    /\/\*\*(?:(?!\*\/)[\s\S])*?\*\/\s*declare const STOP_PROCESSOR: unique symbol;\r?\n/
  if (declaration.test(text)) {
    text = text.replace(declaration, '')
    text = `import type { STOP_PROCESSOR } from './index.js';\n${text}`
  }
  if (/: unique symbol/.test(text))
    throw new Error(`${path}: unexpected "unique symbol" declaration after post-processing`)
  writeFileSync(path, text)
}

for (const file of readdirSync('dist')) {
  if (!file.endsWith('.d.ts') || file === 'styles.d.ts') continue
  const cts = readFileSync(`dist/${file}`, 'utf8').replace(
    "from './index.js'",
    "from './index.cjs'"
  )
  writeFileSync(`dist/${file.replace(/\.d\.ts$/, '.d.cts')}`, cts)
}
writeFileSync('dist/styles.d.ts', 'export {}\n')
writeFileSync('dist/styles.d.cts', 'export {}\n')

const source = readFileSync('src/overlay/styles.ts', 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
})
const { overlayStyles } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
writeFileSync('dist/overlay.css', overlayStyles)
