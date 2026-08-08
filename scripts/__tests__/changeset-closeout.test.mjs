import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CHANGESET_SKIP_FLAGS,
  parseChangesetPackageNames,
  validateChangesetCloseout
} from '../validate-pr-changeset.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const rootManifest = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
)
const ciWorkflow = fs.readFileSync(
  path.join(repositoryRoot, '.github/workflows/main.yml'),
  'utf8'
)
const changesetRecord = (fileName, packageNames = []) => ({
  fileName,
  packageNames
})

test('root and PR validation gates include the closeout Changeset validator', () => {
  assert.match(
    rootManifest.scripts['test:scripts'],
    /scripts\/__tests__\/changeset-closeout\.test\.mjs/
  )
  assert.match(
    rootManifest.scripts['changeset:check'],
    /scripts\/validate-pr-changeset\.mjs/
  )
  assert.match(ciWorkflow, /Validate PR Changeset/)
  assert.match(ciWorkflow, /yarn changeset:check/)
})

test('ordinary code changes require at least one pending Changeset', () => {
  assert.doesNotThrow(() =>
    validateChangesetCloseout({
      changedFiles: ['packages/core/src/core.ts', '.changeset/core-update.md'],
      pendingChangesets: [changesetRecord('core-update.md', ['@asyra/core'])],
      skipFlags: []
    })
  )

  assert.throws(
    () =>
      validateChangesetCloseout({
        changedFiles: ['packages/core/src/core.ts'],
        pendingChangesets: [],
        skipFlags: []
      }),
    /requires a pending Changeset/
  )
})

test('Changeset release entries are limited to Framework packages', () => {
  for (const packageName of [
    'create-asyra-design-app',
    rootManifest.name,
    '@asyra/asyra-design',
    '@asyra/not-a-framework-package'
  ]) {
    assert.throws(
      () =>
        validateChangesetCloseout({
          changedFiles: ['.changeset/invalid-release.md'],
          pendingChangesets: [
            changesetRecord('invalid-release.md', [packageName])
          ],
          skipFlags: []
        }),
      /only packages\/\* Framework packages/
    )
  }
})

test('non-Framework changes use an empty Changeset record', () => {
  assert.doesNotThrow(() =>
    validateChangesetCloseout({
      changedFiles: [
        'create-app/asyra-design/bin/index.js',
        '.changeset/cli-maintenance.md'
      ],
      pendingChangesets: [changesetRecord('cli-maintenance.md')],
      skipFlags: []
    })
  )
})

test('Changeset package parsing supports quoted entries and empty records', () => {
  assert.deepEqual(
    parseChangesetPackageNames(`---
'@asyra/core': patch
"@asyra/render": minor
---
Release note.
`),
    ['@asyra/core', '@asyra/render']
  )
  assert.deepEqual(
    parseChangesetPackageNames(`---
---
Maintenance record.
`),
    []
  )
})

test('docs-only changes may skip only with the explicit docs-only flag', () => {
  assert.doesNotThrow(() =>
    validateChangesetCloseout({
      changedFiles: ['docs/ai/workflows/plan-done-closeout.md'],
      pendingChangesets: [],
      skipFlags: [CHANGESET_SKIP_FLAGS.DOCS_ONLY]
    })
  )

  assert.throws(
    () =>
      validateChangesetCloseout({
        changedFiles: ['docs/ai/workflows/plan-done-closeout.md'],
        pendingChangesets: [],
        skipFlags: []
      }),
    /requires a pending Changeset/
  )

  assert.throws(
    () =>
      validateChangesetCloseout({
        changedFiles: [
          'docs/ai/workflows/plan-done-closeout.md',
          'scripts/release-full.js'
        ],
        pendingChangesets: [],
        skipFlags: [CHANGESET_SKIP_FLAGS.DOCS_ONLY]
      }),
    /docs-only flag requires a documentation-only diff/
  )
})

test('hotfix skip is explicit and the two skip flags are mutually exclusive', () => {
  assert.doesNotThrow(() =>
    validateChangesetCloseout({
      changedFiles: ['packages/core/src/core.ts'],
      pendingChangesets: [],
      skipFlags: [CHANGESET_SKIP_FLAGS.HOTFIX]
    })
  )

  assert.throws(
    () =>
      validateChangesetCloseout({
        changedFiles: ['packages/core/src/core.ts'],
        pendingChangesets: [],
        skipFlags: [CHANGESET_SKIP_FLAGS.DOCS_ONLY, CHANGESET_SKIP_FLAGS.HOTFIX]
      }),
    /mutually exclusive/
  )
})

test('Changeset metadata files do not count as pending release records', () => {
  assert.throws(
    () =>
      validateChangesetCloseout({
        changedFiles: ['packages/core/src/core.ts', '.changeset/README.md'],
        pendingChangesets: [],
        skipFlags: []
      }),
    /requires a pending Changeset/
  )
})
