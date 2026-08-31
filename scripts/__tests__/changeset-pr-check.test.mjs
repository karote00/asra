import assert from 'node:assert/strict'
import test from 'node:test'

import { evaluateChangesetPrDiff } from '../changeset-pr-check.js'

test('accepts a pull request with a pending changeset record', () => {
  const result = evaluateChangesetPrDiff([
    { status: 'A', path: '.changeset/calm-tools-smile.md' },
    { status: 'M', path: 'scripts/example.js' }
  ])

  assert.deepEqual(result, {
    valid: true,
    mode: 'pending-changeset',
    packages: []
  })
})

test('accepts a release pull request with materialized versions and changelogs', () => {
  const result = evaluateChangesetPrDiff([
    { status: 'M', path: 'packages/render/package.json' },
    { status: 'M', path: 'packages/render/CHANGELOG.md' },
    { status: 'D', path: '.changeset/calm-tools-smile.md' }
  ])

  assert.deepEqual(result, {
    valid: true,
    mode: 'materialized-release',
    packages: ['@asyra/render']
  })
})

test('rejects ordinary pull requests without a changeset record', () => {
  const result = evaluateChangesetPrDiff([
    { status: 'M', path: 'docs/README.md' }
  ])

  assert.equal(result.valid, false)
  assert.equal(result.mode, 'missing')
})

test('rejects package version edits without a generated changelog', () => {
  const result = evaluateChangesetPrDiff([
    { status: 'M', path: 'packages/render/package.json' }
  ])

  assert.equal(result.valid, false)
  assert.equal(result.mode, 'missing')
})

test('deleted changesets do not satisfy the pending-record rule by themselves', () => {
  const result = evaluateChangesetPrDiff([
    { status: 'D', path: '.changeset/calm-tools-smile.md' }
  ])

  assert.equal(result.valid, false)
  assert.equal(result.mode, 'missing')
})
