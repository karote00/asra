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
    source.packages.every((record) => record.version === '0.5.0'),
    true
  )
})

test('every preceding Framework release gate resolves to completed plan, Inspector, contract test, and decision entry', () => {
  assert.deepEqual(
    FRAMEWORK_RELEASE_PREREQUISITES.map((record) => record.gate),
    [1, 2, 3, 4]
  )

  const decisionHistory = fs.readFileSync(
    path.join(
      repositoryRoot,
      'docs/ai/framework/decisions/releases/unreleased.md'
    ),
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

test('first-release source set keeps Post-Release Roadmap capabilities unsupported', () => {
  assert.deepEqual(FRAMEWORK_RELEASE_UNSUPPORTED_CAPABILITIES, [
    'auto-layout',
    'unit-aware-aggregation',
    'production-3d',
    'production-hybrid'
  ])
})
