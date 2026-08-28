/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

const projectRoot = path.resolve(__dirname, '../../../..')
const workspaceRoot = path.resolve(__dirname, '..')
const catalogPath = path.join(workspaceRoot, 'catalog.cjs')
const generatorPath = path.join(workspaceRoot, 'generate-workspace.cjs')
const bundlePath = path.join(workspaceRoot, 'workspace-bundle.data.js')
const toolPackagePath = path.resolve(workspaceRoot, '../package.json')
const specPath = path.join(
  projectRoot,
  'docs/ai/tools/flow-inspector/STATIC_WORKSPACE.md'
)
const inspectorPath = path.join(
  projectRoot,
  'docs/ai/tools/flow-inspector/plans/flow-inspector-static-workspace-flow-inspector.data.cjs'
)

const discoverCandidates = (root) =>
  fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) return discoverCandidates(entryPath)
    return /-flow-inspector\.data\.(?:cjs|js)$/.test(entry.name)
      ? [entryPath]
      : []
  })

test('Phase 0 authorities and catalog owners exist', () => {
  assert.equal(fs.existsSync(specPath), true, 'product contract must exist')
  assert.equal(
    fs.existsSync(inspectorPath),
    true,
    'workspace Inspector must exist'
  )
  assert.equal(fs.existsSync(catalogPath), true, 'catalog owner must exist')
  assert.equal(
    fs.existsSync(generatorPath),
    true,
    'catalog generator must exist'
  )
  assert.equal(
    fs.existsSync(bundlePath),
    true,
    'generated browser snapshot must exist'
  )
})

test('preview artifact is independently versioned and static-only', () => {
  const toolPackage = JSON.parse(fs.readFileSync(toolPackagePath, 'utf8'))
  assert.equal(toolPackage.name, '@asyra-tool/flow-inspector')
  assert.equal(toolPackage.version, '0.1.0-preview')
  assert.equal(toolPackage.private, true)
  assert.equal(fs.existsSync(path.join(workspaceRoot, 'workspace.html')), true)
  assert.equal(Object.hasOwn(toolPackage, 'publishConfig'), false)
})

test('workspace Inspector resolves the exact static architecture contract', () => {
  const inspector = require(inspectorPath)
  assert.deepEqual(inspector.schema, { id: 'flow-inspector', version: 2 })
  assert.equal(inspector.target.id, 'flow-inspector-static-workspace')
  assert.deepEqual(
    inspector.steps.map((step) => step.id),
    [
      'discover-inspector-sources',
      'classify-workspace-catalog',
      'generate-browser-snapshot',
      'route-workspace-selection',
      'isolate-selected-target',
      'render-selected-contract',
      'preserve-standalone-entries',
      'verify-static-preview'
    ]
  )
})

test('generated catalog classifies every fixed-root candidate exactly once', () => {
  assert.equal(fs.existsSync(catalogPath), true)
  assert.equal(fs.existsSync(bundlePath), true)
  const catalog = require(catalogPath)
  const sandbox = { globalThis: {} }
  vm.runInNewContext(fs.readFileSync(bundlePath, 'utf8'), sandbox)
  const bundle = JSON.parse(
    JSON.stringify(sandbox.globalThis.FLOW_INSPECTOR_WORKSPACE_BUNDLE)
  )
  assert.deepEqual(bundle.schema, {
    id: 'flow-inspector-workspace-bundle',
    version: 1
  })
  assert.deepEqual(catalog.discoveryRoots, [
    'docs/ai/framework/plans',
    'docs/ai/apps',
    'docs/ai/tools'
  ])
  assert.equal(Array.isArray(catalog.exclusions), true)
  assert.equal(
    new Set(catalog.exclusions.map((item) => item.path)).size,
    catalog.exclusions.length
  )
  assert.equal(
    bundle.entries.length + bundle.exclusions.length,
    bundle.generatedFrom.candidatePaths.length
  )
  assert.equal(
    new Set(bundle.entries.map((entry) => entry.id)).size,
    bundle.entries.length
  )
  const currentCandidates = catalog.discoveryRoots
    .flatMap((root) => discoverCandidates(path.join(projectRoot, root)))
    .map((candidate) =>
      path.relative(projectRoot, candidate).split(path.sep).join('/')
    )
    .sort()
  assert.deepEqual(bundle.generatedFrom.candidatePaths, currentCandidates)
  for (const entry of bundle.entries) {
    assert.equal(fs.existsSync(path.join(projectRoot, entry.sourcePath)), true)
    if (entry.standalonePath) {
      assert.equal(
        fs.existsSync(path.join(projectRoot, entry.standalonePath)),
        true
      )
    }
    const source = require(path.join(projectRoot, entry.sourcePath))
    assert.deepEqual(entry.data, JSON.parse(JSON.stringify(source)))
    if (entry.kind === 'flow-v2') assert.equal(entry.id, entry.data.target.id)
  }
})
