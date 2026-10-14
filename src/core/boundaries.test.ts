import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// vitest runs from the repository root
const here = join(process.cwd(), 'src', 'core')

describe('the core stays independent of the optional subpaths', () => {
  const files = readdirSync(here).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files)('%s imports nothing from notify, overlay, files or csrf', file => {
    const source = readFileSync(join(here, file), 'utf8')
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
    for (const target of imports)
      expect(target, `${file} -> ${target}`).not.toMatch(/^\.\.\/(notify|overlay|files|csrf)(\/|$)/)
  })

  it('src/index.ts only exports from ./core', () => {
    const source = readFileSync(join(process.cwd(), 'src', 'index.ts'), 'utf8')
    const targets = [...source.matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) expect(target).toMatch(/^\.\/core\//)
  })
})
