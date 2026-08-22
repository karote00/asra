import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  validateGeneratedReadmePair,
  validatePublicReadmes,
  validateReadmeLinks,
  validateReadmeLearningSurface,
  validateReadmeNamedImports,
  validateReadmePolicy
} from '../public-readme-validation.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('complete public README corpus passes owner, link, API, policy, and generation gates', async () => {
  const summary = await validatePublicReadmes({ repositoryRoot })
  assert.equal(summary.surfaceCount, 24)
  assert.equal(summary.packageCount, 19)
  assert.ok(summary.linkCount > 70)
  assert.equal(summary.generatedReadmeSynchronized, true)
})

test('README policy rejects missing policy and external contribution invitations', () => {
  assert.throws(
    () =>
      validateReadmePolicy({
        source: 'Use and fork this package.',
        sourcePath: 'README.md'
      }),
    /missing the public support policy/
  )
  assert.throws(
    () =>
      validateReadmePolicy({
        source:
          'This repository does not accept external issues or contributions. Pull requests are welcome.',
        sourcePath: 'README.md'
      }),
    /invites unsupported external contributions/
  )
})

test('README learning surfaces reject retired example runners and source links', () => {
  for (const source of [
    'Run `yarn examples:run old-proof`.',
    '[Examples](docs/examples/README.md)',
    '[Extension](apps/asyra-design/examples/extension.mjs)'
  ]) {
    assert.throws(
      () =>
        validateReadmeLearningSurface({
          source,
          sourcePath: 'README.md'
        }),
      /removed executable-example surface/
    )
  }
})

test('README link validation rejects missing and unverified destinations', () => {
  assert.doesNotThrow(() => {
    validateReadmeLinks({
      filePath: path.join(repositoryRoot, 'README.md'),
      repositoryRoot,
      source: '[demo](https://asyra-design.vercel.app/?fileId=demo)'
    })
  })
  assert.throws(
    () =>
      validateReadmeLinks({
        filePath: path.join(repositoryRoot, 'README.md'),
        repositoryRoot,
        source: '[missing](missing-readme-target.md)'
      }),
    /broken local link/
  )
  assert.throws(
    () =>
      validateReadmeLinks({
        filePath: path.join(repositoryRoot, 'README.md'),
        repositoryRoot,
        source: '[unknown](https://unverified.example/docs)'
      }),
    /unverified public link/
  )
})

test('README named imports resolve against the exact public entrypoint', () => {
  const apiIndex = {
    packages: [
      {
        entries: [{ path: '.', symbols: ['Core'] }],
        name: '@asyra/core'
      }
    ]
  }
  assert.doesNotThrow(() =>
    validateReadmeNamedImports({
      apiIndex,
      source: "import { Core } from '@asyra/core'",
      sourcePath: 'README.md'
    })
  )
  assert.throws(
    () =>
      validateReadmeNamedImports({
        apiIndex,
        source: "import { PrivateCore } from '@asyra/core'",
        sourcePath: 'README.md'
      }),
    /unresolved public APIs/
  )
})

test('generated README validation rejects byte drift', () => {
  assert.doesNotThrow(() =>
    validateGeneratedReadmePair({
      output: Buffer.from('same'),
      source: Buffer.from('same')
    })
  )
  assert.throws(
    () =>
      validateGeneratedReadmePair({
        output: Buffer.from('changed'),
        source: Buffer.from('source')
      }),
    /Generated Asyra Design README is stale/
  )
})
