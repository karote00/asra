import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  EXAMPLE_SOURCES,
  loadExample
} from '../../../docs/examples/run-example.mjs'
import {
  createExampleConsumerPlan,
  EXAMPLE_IDS
} from '../examples-readiness.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('public example consumer owns the exact Inspector suite', async () => {
  assert.deepEqual(EXAMPLE_IDS, Object.keys(EXAMPLE_SOURCES))

  for (const id of EXAMPLE_IDS) {
    const example = await loadExample(id)
    assert.equal(example.definition.id, id)
    assert.equal(example.source, EXAMPLE_SOURCES[id])
    assert.ok(fs.existsSync(path.join(repositoryRoot, example.source)))
    assert.match(example.definition.runCommand, new RegExp(`${id}$`, 'u'))
  }
})

test('local and registry plans execute the same source and public commands', () => {
  const local = createExampleConsumerPlan({ mode: 'local' })
  const registry = createExampleConsumerPlan({ mode: 'registry' })

  assert.deepEqual(local.sourceDirectories, registry.sourceDirectories)
  assert.deepEqual(local.commands, registry.commands)
  assert.equal(local.commands.length, EXAMPLE_IDS.length + 2)
  assert.doesNotMatch(JSON.stringify(local), /workspace:|packages\/.*\/src/u)
  assert.throws(
    () => createExampleConsumerPlan({ mode: 'unknown' }),
    /Unknown example consumer mode/u
  )
})
