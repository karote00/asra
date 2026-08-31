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
  assert.equal(inputs.specialSurfaces.length, 4)
  assert.equal(inputs.surfaces.length, 23)
  assert.equal(
    new Set(inputs.surfaces.map(({ path: value }) => value)).size,
    23
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
    source: 'apps/asyra-design/README.md'
  })
})

test('root README follows the product-to-proof reader journey', () => {
  const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8')

  assert.match(readme, /https:\/\/asyra-design\.vercel\.app\/\?fileId=demo/u)
  assert.deepEqual(
    [...readme.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/gu)].map(
      (match) => match[1]
    ),
    [],
    'external README links must use safe new-tab HTML anchors'
  )
  const externalAnchors = [
    ...readme.matchAll(/<a\s+([^>]*href="https?:\/\/[^"]+"[^>]*)>/gu)
  ]
  assert.equal(
    externalAnchors.filter(([, attributes]) =>
      attributes.includes('href="https://asyra-design.vercel.app/?fileId=demo"')
    ).length,
    2
  )
  externalAnchors.forEach(([, attributes]) => {
    assert.match(attributes, /(?:^|\s)target="_blank"(?:\s|$)/u)
    assert.match(attributes, /(?:^|\s)rel="noopener noreferrer"(?:\s|$)/u)
  })
  assert.match(
    readme,
    /\n- <a href="https:\/\/asyra-design\.vercel\.app\/\?fileId=demo"[^>]*>Try Asyra Design<\/a>\n- \[Read the documentation\]\(docs\/public\/index\.md\)\n- \[Install `@asyra\/core`\]\(#package-first-composition\)\n- \[Create an Asyra Design app\]\(#complete-design-product\)\n/u
  )
  assert.match(readme, /## Try the demo/u)
  assert.match(readme, /Asyra Design case study/u)
  assert.match(readme, /## One product behavior, one explicit owner/u)
  assert.match(readme, /Conventional product/u)
  assert.match(readme, /With Asyra/u)
  assert.match(readme, /## A real App-owned Feature/u)
  assert.match(readme, /defineFeature/u)
  assert.match(readme, /historyApis\.(undo|redo)/u)
  assert.match(readme, /Build a transaction-safe Feature/u)
  assert.match(readme, /## Choose your starting point/u)
  assert.match(readme, /npm install @asyra\/core/u)
  assert.match(
    readme,
    /npx create-asyra-design-app my-product --package-manager=npm[\s\S]*npm run start/u
  )
  assert.doesNotMatch(readme, /create-asyra-app|one React homepage/u)
  assert.match(readme, /Build product features, not infrastructure/u)
  assert.match(
    readme,
    /build\s+canvas-based editors, whiteboards, BIM workspaces, industrial tools,\s+simulations, and other domain products/u
  )
  assert.match(
    readme,
    /without coupling domain rules to one\s+renderer or UI framework/u
  )
  assert.match(readme, /Yarn, npm, or pnpm/u)
  assert.match(readme, /prints the exact start command/u)
  assert.match(
    readme,
    /Start, Concepts, Extend,\s+Customize, Reference, and the Asyra Design case study/u
  )
  assert.doesNotMatch(readme, /Start, Learn, Build, Reference/u)
  assert.match(
    readme,
    /App-owned Feature\s+→ App or Framework API\s+→ transaction and validation boundary\s+→ canonical state owner/u
  )
  assert.doesNotMatch(readme, /flowchart (TD|LR)/u)
  assert.match(readme, /### Built and demonstrated today/u)
  assert.match(readme, /### Compose your domain/u)
  assert.match(readme, /### Not turnkey modules/u)
  assert.match(readme, /19 public `@asyra\/\*` ESM packages/u)
  assert.match(readme, /Node\.js 24\.x/u)
  assert.match(readme, /Production `3D`, `HYBRID`/u)
  assert.match(readme, /does not accept external issues or contributions/u)
  assert.doesNotMatch(
    readme,
    /Runtime Atlas|release candidates|does not independently authorize a release|Yarn 4\.3\.1/u
  )
})

test('Asyra Design README is the standalone generated-product guide', () => {
  const readme = fs.readFileSync(
    path.join(repositoryRoot, 'apps/asyra-design/README.md'),
    'utf8'
  )

  assert.match(readme, /standalone, editable Asyra Design product/u)
  assert.match(readme, /## Install and start/u)
  assert.match(readme, /## Start editing/u)
  assert.match(readme, /## Run the complete local services/u)
  assert.match(readme, /## Make your first extension/u)
  assert.match(readme, /## Build with an AI coding agent/u)
  assert.match(readme, /## Framework flows/u)
  assert.match(readme, /yarn start/u)
  assert.match(readme, /Without `.env`.*local-only mode/su)
  assert.match(readme, /Collaboration offline state.*durable outbox/su)
  assert.doesNotMatch(readme, /yarn dev:all|Start in this repository/u)
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
