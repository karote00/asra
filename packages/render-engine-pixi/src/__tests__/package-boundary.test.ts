import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const workspaceRoot = path.resolve(packageRoot, '../..')

const getSourceFiles = (directory: string): string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : getSourceFiles(entryPath)
    }
    return entry.name.endsWith('.ts') ? [entryPath] : []
  })

describe('@asyra/render-engine-pixi package boundary', () => {
  it('depends on the abstract contract and never on @asyra/render', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> }
    const sources = getSourceFiles(path.join(packageRoot, 'src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n')

    expect(packageJson.dependencies).toEqual({
      '@asyra/render-engine': 'workspace:*',
      'pixi.js': '^8.6.3'
    })
    expect(sources).not.toMatch(/from ['"]@asyra\/render(?:['"/])/)
  })

  it('does not publish production 3D, Hybrid, or render-mode branches', () => {
    const sources = getSourceFiles(path.join(packageRoot, 'src'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n')

    expect(sources).not.toMatch(/\b(?:3d|hybrid|render[- ]mode)\b/i)
  })

  it('keeps generated build edges for the concrete engine boundary', () => {
    const turbo = JSON.parse(
      fs.readFileSync(path.join(workspaceRoot, 'turbo.json'), 'utf8')
    ) as {
      tasks: Record<string, { dependsOn?: string[] }>
    }

    expect(
      turbo.tasks['@asyra/render-engine-pixi#build:render-engine-pixi']
        .dependsOn
    ).toContain('@asyra/render-engine#build:render-engine')
    expect(turbo.tasks['@asyra/preset#build:preset'].dependsOn).toEqual(
      expect.arrayContaining([
        '@asyra/render-engine#build:render-engine',
        '@asyra/render-engine-pixi#build:render-engine-pixi'
      ])
    )
    expect(turbo.tasks['@asyra/asyra-design#react:build'].dependsOn).toContain(
      '@asyra/render#build:render'
    )
  })
})
