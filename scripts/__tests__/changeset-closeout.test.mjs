import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CHANGESET_SKIP_FLAGS,
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
      pendingChangesets: ['core-update.md'],
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
