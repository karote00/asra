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
  assert.equal(inputs.specialSurfaces.length, 5)
  assert.equal(inputs.surfaces.length, 24)
  assert.equal(
    new Set(inputs.surfaces.map(({ path: value }) => value)).size,
    24
  )
  for (const retiredSurface of [
    'apps/asyra/README.md',
    'create-app/asyra/README.md',
    'create-app/asyra/template/README.md'
  ]) {
    assert.equal(
      inputs.specialSurfaces.some(
        ({ path: surfacePath }) => surfacePath === retiredSurface
      ),
      false,
      retiredSurface
    )
  }
  assert.deepEqual(inputs.generatedReadme, {
    configPath: 'release-configs/asyra-design.json',
    output: 'create-app/asyra-design/template/README.md',
    source: 'apps/asyra-design/TEMPLATE.md'
  })
})

test('root README exposes package-first composition and the working product starter', () => {
  const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8')

  assert.match(
    readme,
    /https:\/\/asyra-karote00s-projects\.vercel\.app\/\?fileId=demo/u
  )
  assert.match(readme, /npm install @asyra\/core/u)
  assert.match(
    readme,
    /npx create-asyra-design-app my-product --package-manager=npm[\s\S]*npm run start/u
  )
  assert.doesNotMatch(readme, /create-asyra-app|one React homepage/u)
  assert.match(readme, /working design-tool foundation/u)
  assert.match(readme, /Build product features, not infrastructure/u)
  assert.match(
    readme,
    /composable building blocks for turning domain-owned information and rules into products/u
  )
  assert.doesNotMatch(readme, /reusable infrastructure behind a product/u)
  assert.match(readme, /A Feature is an App-owned, registered unit/u)
  assert.match(readme, /Add, replace, or remove a registered Feature/u)
  assert.match(readme, /a few focused lines/u)
  assert.match(readme, /Compose only what the product needs/u)
  assert.match(readme, /Runtime commit and durable persistence/u)
  assert.match(readme, /Yarn, npm, or pnpm/u)
  assert.match(readme, /prints the exact start command/u)
  assert.match(readme, /flowchart TD/u)
  assert.doesNotMatch(readme, /flowchart LR/u)
  assert.doesNotMatch(
    readme,
    /Runtime Atlas|release candidates|does not independently authorize a release|Yarn 4\.3\.1/u
  )
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
