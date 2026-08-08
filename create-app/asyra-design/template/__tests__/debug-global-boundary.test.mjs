import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(appRoot, '../..')
const workspaceAppRoot = path.join(repositoryRoot, 'apps/asyra-design')
const runsFromWorkspaceApp = appRoot === workspaceAppRoot
const reportRoot = runsFromWorkspaceApp ? repositoryRoot : appRoot
const sourceRoots = runsFromWorkspaceApp
  ? [
      workspaceAppRoot,
      path.join(repositoryRoot, 'packages'),
      path.join(repositoryRoot, 'scripts')
    ]
  : [appRoot]
const sourceExtensions = new Set(['.cjs', '.js', '.mjs', '.ts', '.tsx'])
const ignoredDirectories = new Set([
  '.turbo',
  '.vercel',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results'
])
const debugHandleNames = [
  'AiDrawingPerformance',
  'CanvasPipelineDebugger',
  'Collaboration',
  'Core'
].map((name) => `__${name}__`)
const hiddenGlobalPattern = /__[A-Z][A-Za-z0-9_]*__/g
const allowedDefinitionFiles = new Set([
  'src/collaboration/lifecycle.ts',
  'src/contexts/core.ts',
  'src/init/diagnostics/init-canvas-pipeline-debugger.ts',
  'src/init/performance/ai-drawing-performance-profile.ts',
  'src/types.d.ts'
])

const collectSourceFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return []
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(entryPath)
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : []
  })

test('debug Window handles are defined for human DevTools but never consumed by code', () => {
  const violations = sourceRoots
    .flatMap(collectSourceFiles)
    .flatMap((filePath) => {
      const relativePath = path.relative(reportRoot, filePath)
      const appRelativePath = path.relative(appRoot, filePath)
      if (relativePath.endsWith('debug-global-boundary.test.mjs')) return []
      const source = fs.readFileSync(filePath, 'utf8')
      const names = source.match(hiddenGlobalPattern) ?? []
      const allowedNames = allowedDefinitionFiles.has(appRelativePath)
        ? new Set(debugHandleNames)
        : new Set()
      return names
        .filter((name) => !allowedNames.has(name))
        .map((name) => ({ file: relativePath, name }))
    })

  assert.deepEqual(violations, [])
})
