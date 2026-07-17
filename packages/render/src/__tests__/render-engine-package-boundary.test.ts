import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const getSourceFiles = (directory: string, includeTests = false): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' && !includeTests
        ? []
        : getSourceFiles(entryPath, includeTests)
    }
    return entry.name.endsWith('.ts') ? [entryPath] : []
  })

describe('@asyra/render engine package boundary', () => {
  it('depends on the abstract contract and not a concrete engine SDK', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> }

    expect(packageJson.dependencies).toHaveProperty(
      '@asyra/render-engine',
      'workspace:*'
    )
    expect(packageJson.dependencies).not.toHaveProperty(
      '@asyra/render-engine-pixi'
    )
    expect(packageJson.dependencies).not.toHaveProperty('pixi.js')
  })

  it('contains no production Pixi or concrete-engine import', () => {
    const violations = getSourceFiles(path.join(packageRoot, 'src'), true)
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8')
        return (
          /from ['"]pixi\.js['"]/.test(source) ||
          /from ['"]@asyra\/render-engine-pixi(?:['"/])/.test(source)
        )
      })
      .map((file) => path.relative(packageRoot, file))

    expect(violations).toEqual([])
  })

  it('exposes no placeholder 3D or Hybrid renderer contract', () => {
    const violations = getSourceFiles(path.join(packageRoot, 'src'))
      .filter((file) => {
        const source = fs.readFileSync(file, 'utf8')
        return /\b(?:ThreeJS|Hybrid)\b/.test(source)
      })
      .map((file) => path.relative(packageRoot, file))

    expect(violations).toEqual([])
  })

  it('uses provider terminology without the unreleased factory API', () => {
    const publicSource = [
      fs.readFileSync(path.join(packageRoot, 'src/render.ts'), 'utf8'),
      fs.readFileSync(path.join(packageRoot, 'src/index.ts'), 'utf8')
    ].join('\n')

    expect(publicSource).toMatch(/RenderEngineProvider/)
    expect(publicSource).not.toMatch(
      /RenderEngineFactory|engineFactory|setEngineFactory/
    )
  })
})
