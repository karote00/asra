import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { readApprovedReadmeInputs } from '../public-readme-inputs.mjs'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('README inputs derive the exact release surfaces and owners', async () => {
  const inputs = await readApprovedReadmeInputs({ repositoryRoot })
  assert.equal(inputs.packages.length, 19)
  assert.equal(inputs.specialSurfaces.length, 5)
  assert.equal(inputs.surfaces.length, 24)
  assert.equal(new Set(inputs.surfaces.map(({ path: value }) => value)).size, 24)
  assert.deepEqual(inputs.generatedReadme, {
    configPath: 'release-configs/asyra-design.json',
    output: 'create-app/asyra-design/template/README.md',
    source: 'apps/asyra-design/TEMPLATE.md'
  })
})

test('every package input resolves a public guide and maintained example', async () => {
  const inputs = await readApprovedReadmeInputs({ repositoryRoot })
  inputs.packages.forEach((packageRecord) => {
    assert.equal(packageRecord.guide.title, packageRecord.name)
    assert.equal(
      packageRecord.guide.id,
      `reference/packages/${packageRecord.directory}`
    )
    assert.ok(packageRecord.publicEntries.length > 0, packageRecord.name)
    assert.ok(packageRecord.examples.length > 0, packageRecord.name)
    packageRecord.examples.forEach((example) => {
      assert.match(
        example.source,
        /^(?:docs\/examples|apps\/asyra-design\/examples)\//
      )
      assert.match(example.runCommand, /^yarn examples:run /)
    })
  })
})

test('README inputs are deeply immutable', async () => {
  const inputs = await readApprovedReadmeInputs({ repositoryRoot })
  assert.ok(Object.isFrozen(inputs))
  assert.ok(Object.isFrozen(inputs.packages))
  assert.ok(Object.isFrozen(inputs.packages[0]))
  assert.ok(Object.isFrozen(inputs.packages[0].examples))
})
