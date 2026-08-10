import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  readPublicContentContract,
  validatePublicContentManifest
} from '../public-content-contract.mjs'
import { readApprovedDocumentationInputs } from '../public-documentation-inputs.mjs'

const require = createRequire(import.meta.url)
const inspector = require('../../../docs/ai/framework/plans/asyra-public-package-documentation-flow-inspector.data.cjs')
const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
)

test('content manifest owns the exact stable documentation inventory', async () => {
  const contract = await readPublicContentContract({ repositoryRoot })

  assert.equal(contract.schemaVersion, 1)
  assert.equal(contract.pages.length, 41)
  assert.deepEqual(
    contract.pages.map(({ id }) => id),
    inspector.pageIds
  )
  assert.equal(contract.pages[0].path, 'index.md')
  for (const page of contract.pages.slice(1)) {
    assert.equal(page.path, `${page.id}.md`)
  }
})

test('every page mapping resolves approved sources, packages, and examples', async () => {
  const contract = await readPublicContentContract({ repositoryRoot })
  const inputs = await readApprovedDocumentationInputs({ repositoryRoot })
  const packageNames = new Set(inputs.packages.map(({ name }) => name))
  const exampleIds = new Set(inputs.examples.map(({ id }) => id))

  for (const page of contract.pages) {
    assert.ok(page.title)
    assert.ok(page.description)
    assert.ok(page.sources.length > 0)
    page.packages.forEach((name) => assert.ok(packageNames.has(name)))
    page.examples.forEach((id) => assert.ok(exampleIds.has(id)))
  }

  for (const packageGuideId of inspector.packageGuideIds) {
    const page = contract.pages.find(({ id }) => id === packageGuideId)
    assert.deepEqual(page.packages, [
      `@asyra/${packageGuideId.slice('reference/packages/'.length)}`
    ])
  }
})

test('content validation fails closed on duplicate, private, or unknown inputs', async () => {
  const contract = await readPublicContentContract({ repositoryRoot })
  const inputs = await readApprovedDocumentationInputs({ repositoryRoot })
  const validate = (mutate) => {
    const candidate = structuredClone(contract)
    mutate(candidate)
    return () =>
      validatePublicContentManifest({
        inputs,
        manifest: candidate,
        repositoryRoot
      })
  }

  assert.throws(
    validate((candidate) => {
      candidate.pages[1].id = candidate.pages[0].id
    }),
    /exact ordered page inventory/
  )
  assert.throws(
    validate((candidate) => {
      candidate.pages[0].sources = [
        'docs/ai/framework/plans/completed/ai-agent-runtime-plan.md'
      ]
    }),
    /unapproved source/
  )
  assert.throws(
    validate((candidate) => {
      candidate.pages[0].packages = ['@asyra/private-runtime']
    }),
    /unknown package/
  )
  assert.throws(
    validate((candidate) => {
      candidate.pages[0].examples = ['handwritten-example']
    }),
    /unknown example/
  )
  assert.throws(
    validate((candidate) => {
      candidate.pages[0].path = '../website-owned.md'
    }),
    /stable Markdown path/
  )
})
