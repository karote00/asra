import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  FRAMEWORK_RELEASE_PACKAGE_NAMES,
  FRAMEWORK_RELEASE_PREREQUISITES,
  FRAMEWORK_RELEASE_UNSUPPORTED_CAPABILITIES,
  readFrameworkReleaseSource
} from '../framework-release-packages.js'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

const expectedPackageNames = [
  '@asyra/ai-agent-runtime',
  '@asyra/collaboration',
  '@asyra/core',
  '@asyra/design-system',
  '@asyra/factory',
  '@asyra/feature-system',
  '@asyra/input-system',
  '@asyra/persistence',
  '@asyra/preset',
  '@asyra/props-manager',
  '@asyra/reactive-events',
  '@asyra/render',
  '@asyra/render-engine',
  '@asyra/render-engine-pixi',
  '@asyra/scene-tree',
  '@asyra/selection',
  '@asyra/system-context',
  '@asyra/ui-context',
  '@asyra/utils'
]

test('Framework Release Gate 5 freezes the exact public package set', () => {
  assert.deepEqual(FRAMEWORK_RELEASE_PACKAGE_NAMES, expectedPackageNames)

  const source = readFrameworkReleaseSource({ repositoryRoot })
  assert.deepEqual(
    source.packages.map((record) => record.name),
    expectedPackageNames
  )
  assert.equal(source.baseline.packageCount, expectedPackageNames.length)
  assert.equal(
    source.packages.every((record) => record.private === false),
    true
  )
  assert.equal(
    source.packages.every((record) => /^\d+\.\d+\.\d+$/u.test(record.version)),
    true
  )
  assert.equal(
    new Set(
      source.packages.map(({ version }) =>
        version.split('.').slice(0, 2).join('.')
      )
    ).size,
    1
  )
})

test('every preceding Framework release gate resolves to completed plan, Inspector, contract test, and released decision entry', () => {
  assert.deepEqual(
    FRAMEWORK_RELEASE_PREREQUISITES.map((record) => record.gate),
    [1, 2, 3, 4]
  )

  const decisionHistory = fs.readFileSync(
    path.join(repositoryRoot, 'docs/ai/framework/decisions/releases/v0.5.0.md'),
    'utf8'
  )
  for (const prerequisite of FRAMEWORK_RELEASE_PREREQUISITES) {
    for (const relativePath of [
      prerequisite.planPath,
      prerequisite.inspectorPath,
      prerequisite.contractTestPath
    ]) {
      assert.equal(
        fs.existsSync(path.join(repositoryRoot, relativePath)),
        true,
        `Gate ${prerequisite.gate} missing ${relativePath}`
      )
    }

    const plan = fs.readFileSync(
      path.join(repositoryRoot, prerequisite.planPath),
      'utf8'
    )
    assert.match(plan, prerequisite.completedPattern)
    assert.match(plan, /Inspector/i)
    assert.match(decisionHistory, prerequisite.decisionPattern)
  }
})

const closeoutEntries = [
  '## 2026-07-19 - Confirm app-level migration Gate 1 closeout',
  '## 2026-07-23 - Close network collaboration transport Release Gate 2',
  '## 2026-07-24 - Close Group component and hierarchy Release Gate 3',
  '## 2026-07-25 - Close optional AI Agent Runtime Release Gate 4'
]

function historyFixture(t, history, version = '0.5.0') {
  const parent = path.join(repositoryRoot, 'tmp')
  fs.mkdirSync(parent, { recursive: true })
  const root = fs.mkdtempSync(path.join(parent, 'release-history-test-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const manifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  )
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ ...manifest, version })
  )
  const copy = (relative) => {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    fs.copyFileSync(
      path.join(repositoryRoot, relative),
      path.join(root, relative)
    )
  }
  for (const name of FRAMEWORK_RELEASE_PACKAGE_NAMES)
    copy(`packages/${name.slice('@asyra/'.length)}/package.json`)
  for (const prerequisite of FRAMEWORK_RELEASE_PREREQUISITES)
    for (const relative of [
      prerequisite.planPath,
      prerequisite.inspectorPath,
      prerequisite.contractTestPath
    ])
      copy(relative)
  const releases = path.join(root, 'docs/ai/framework/decisions/releases')
  fs.mkdirSync(releases, { recursive: true })
  for (const [name, content] of Object.entries(history))
    fs.writeFileSync(path.join(releases, name), content)
  return root
}

test('first-release history can live entirely in unreleased decisions', (t) => {
  const root = historyFixture(t, {
    'unreleased.md': closeoutEntries.join('\n')
  })
  const source = readFrameworkReleaseSource({ repositoryRoot: root })
  assert.deepEqual(
    source.prerequisites.map((item) => item.decisionPaths),
    closeoutEntries.map(() => [
      'docs/ai/framework/decisions/releases/unreleased.md'
    ])
  )
})

test('new unreleased work does not hide archived prerequisite decisions', (t) => {
  const root = historyFixture(t, {
    'unreleased.md': '## New runtime work\n',
    'v0.5.0.md': closeoutEntries.join('\n')
  })
  const source = readFrameworkReleaseSource({ repositoryRoot: root })
  assert.equal(source.prerequisites.length, 4)
  assert.deepEqual(source.prerequisites[0].decisionPaths, [
    'docs/ai/framework/decisions/releases/v0.5.0.md'
  ])
})

test('historical prerequisites remain traceable across multiple archives and a later root version', (t) => {
  const root = historyFixture(
    t,
    {
      'unreleased.md': '## Next development cycle\n',
      'v0.5.0.md': closeoutEntries.slice(0, 2).join('\n'),
      'v0.6.0.md': closeoutEntries.slice(2).join('\n')
    },
    '0.7.0'
  )
  const source = readFrameworkReleaseSource({ repositoryRoot: root })
  assert.deepEqual(
    source.prerequisites.map((item) => item.decisionPaths[0]),
    [
      'docs/ai/framework/decisions/releases/v0.5.0.md',
      'docs/ai/framework/decisions/releases/v0.5.0.md',
      'docs/ai/framework/decisions/releases/v0.6.0.md',
      'docs/ai/framework/decisions/releases/v0.6.0.md'
    ]
  )
})

test('missing required decisions still fail and unrelated Markdown cannot supply release history', (t) => {
  const root = historyFixture(t, {
    'unreleased.md': '## New work\n',
    'v0.5.0.md': closeoutEntries.slice(1).join('\n'),
    'README.md': closeoutEntries[0],
    'v0.5.0-copy.md': closeoutEntries[0]
  })
  assert.throws(
    () => readFrameworkReleaseSource({ repositoryRoot: root }),
    /Gate 1 lacks decision history/
  )
})

test('first-release source set keeps Post-Release Roadmap capabilities unsupported', () => {
  assert.deepEqual(FRAMEWORK_RELEASE_UNSUPPORTED_CAPABILITIES, [
    'auto-layout',
    'unit-aware-aggregation',
    'production-3d',
    'production-hybrid'
  ])
})
