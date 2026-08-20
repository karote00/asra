import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  checkPublicPackageReadmes,
  generatePublicPackageReadmes
} from '../public-package-readmes.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('package README generator owns the exact release package set', async () => {
  const readmes = await generatePublicPackageReadmes({ repositoryRoot })
  assert.equal(readmes.length, 19)
  assert.equal(new Set(readmes.map(({ path: value }) => value)).size, 19)
  readmes.forEach((readme) => {
    assert.match(readme.path, /^packages\/[a-z0-9-]+\/README\.md$/)
    assert.match(readme.content, /## Owns\n/)
    assert.match(readme.content, /## Does not own\n/)
    assert.match(readme.content, /Node\.js 24\.x/)
    assert.doesNotMatch(readme.content, /examples:run|docs\/examples/)
    assert.match(
      readme.content,
      /This repository does not accept external issues or contributions/
    )
  })
})

test('checked-in package READMEs match deterministic generation', async () => {
  assert.equal(await checkPublicPackageReadmes({ repositoryRoot }), 19)
})
