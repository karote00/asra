import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const getSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : getSourceFiles(entryPath)
    }
    return entry.name.endsWith('.ts') ? [entryPath] : []
  })

describe('@asyra/render-engine package boundary', () => {
  it('has no production dependency on an engine SDK or framework runtime', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> }
    const sources = getSourceFiles(path.join(packageRoot, 'src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n')

    expect(packageJson.dependencies ?? {}).toEqual({})
    expect(sources).not.toMatch(/from ['"](?:pixi\.js|three|@asyra\/)/)
    expect(sources).not.toMatch(
      /\b(?:HTMLElement|HTMLCanvasElement|OffscreenCanvas|CanvasRenderingContext2D|document|window)\b/
    )
  })

  it('does not publish production 3D, Hybrid, or render-mode identifiers', () => {
    const sources = getSourceFiles(path.join(packageRoot, 'src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n')

    expect(sources).not.toMatch(/\b(?:3d|hybrid|render[- ]mode)\b/i)
  })

  it('publishes provider terminology without the unreleased factory alias', () => {
    const publicSource = [
      fs.readFileSync(path.join(packageRoot, 'src/index.ts'), 'utf8'),
      fs.readFileSync(path.join(packageRoot, 'src/types.ts'), 'utf8')
    ].join('\n')

    expect(publicSource).toMatch(/RenderEngineProvider/)
    expect(publicSource).not.toMatch(/RenderEngineFactory/)
  })
})
