import assert from 'node:assert/strict'
import fs from 'node:fs'
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
  assert.equal(inputs.specialSurfaces.length, 8)
  assert.equal(inputs.surfaces.length, 27)
  assert.equal(
    new Set(inputs.surfaces.map(({ path: value }) => value)).size,
    27
  )
  assert.equal(
    inputs.specialSurfaces.some(
      ({ path: surfacePath }) => surfacePath === 'apps/asyra/TEMPLATE.md'
    ),
    false
  )
  assert.deepEqual(inputs.generatedReadme, {
    configPath: 'release-configs/asyra-design.json',
    output: 'create-app/asyra-design/template/README.md',
    source: 'apps/asyra-design/TEMPLATE.md'
  })
})

test('root README exposes the demo and both product starting points', () => {
  const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8')

  assert.match(
    readme,
    /https:\/\/asyra-karote00s-projects\.vercel\.app\/\?fileId=demo/u
  )
  assert.match(readme, /npx create-asyra-app my-product/u)
  assert.match(readme, /npx create-asyra-design-app my-product/u)
  assert.match(readme, /one React homepage/u)
  assert.match(readme, /working design-tool foundation/u)
})

test('every package input resolves its complete public guide without example commands', async () => {
  const inputs = await readApprovedReadmeInputs({ repositoryRoot })
  inputs.packages.forEach((packageRecord) => {
    assert.equal(packageRecord.guide.title, packageRecord.name)
    assert.equal(
      packageRecord.guide.id,
      `reference/packages/${packageRecord.directory}`
    )
    assert.ok(packageRecord.publicEntries.length > 0, packageRecord.name)
    assert.equal('examples' in packageRecord, false)
  })
})

test('README inputs are deeply immutable', async () => {
  const inputs = await readApprovedReadmeInputs({ repositoryRoot })
  assert.ok(Object.isFrozen(inputs))
  assert.ok(Object.isFrozen(inputs.packages))
  assert.ok(Object.isFrozen(inputs.packages[0]))
  assert.ok(Object.isFrozen(inputs.packages[0].guide))
})
