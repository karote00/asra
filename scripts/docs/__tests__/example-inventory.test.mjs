import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { EXAMPLE_SOURCES } from '../../../docs/examples/run-example.mjs'
import {
  checkExampleInventory,
  createExampleInventory,
  extractSourceRegion
} from '../example-inventory.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('inventory derives the exact ordered Inspector suite and release versions', async () => {
  const inventory = await createExampleInventory({ repositoryRoot })

  assert.equal(inventory.schemaVersion, 1)
  assert.equal(inventory.examples.length, 11)
  assert.deepEqual(
    inventory.examples.map(({ id }) => id),
    Object.keys(EXAMPLE_SOURCES)
  )
  assert.equal(inventory.release.packageCount, 19)

  for (const [index, example] of inventory.examples.entries()) {
    assert.equal(example.order, index + 1)
    assert.ok(example.title)
    assert.ok(example.environment)
    assert.ok(example.runCommand.endsWith(example.id))
    assert.ok(example.expectedResult)
    assert.ok(example.publicPackages.length > 0)
    for (const packageRecord of example.publicPackages) {
      const manifestPath = path.join(
        repositoryRoot,
        'packages',
        packageRecord.name.slice('@asyra/'.length),
        'package.json'
      )
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      assert.equal(packageRecord.version, manifest.version)
    }
  }
})

test('every inventory snippet is byte-identical to its tested source region', async () => {
  const inventory = await createExampleInventory({ repositoryRoot })

  for (const example of inventory.examples) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, example.source),
      'utf8'
    )
    const extracted = extractSourceRegion({
      source,
      region: example.sourceRegion,
      sourcePath: example.source
    })
    assert.equal(example.snippet, extracted)
    assert.equal(
      example.snippetSha256,
      createHash('sha256').update(extracted).digest('hex')
    )
  }
})

test('checked-in inventory matches the deterministic generator', async () => {
  const inventory = await checkExampleInventory({ repositoryRoot })
  assert.deepEqual(
    inventory.examples.map(({ id }) => id),
    Object.keys(EXAMPLE_SOURCES)
  )
})
