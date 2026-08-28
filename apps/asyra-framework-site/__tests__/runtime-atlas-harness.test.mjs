import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const siteRoot = path.resolve(import.meta.dirname, '..')

test('Runtime Atlas freezes six plain-language cases and ordered actions', async () => {
  const { ATLAS_CASES, ATLAS_CASE_IDS } = await import(
    '../lib/runtime-atlas/case-definitions.mjs'
  )

  assert.deepEqual(ATLAS_CASE_IDS, [
    'continuous-pointer-undo',
    'canonical-projection-fanout',
    'invalid-input-rollback',
    'collaboration-two-actors',
    'ai-registered-action',
    'machine-retrieval-action'
  ])
  assert.equal(ATLAS_CASES.length, 6)
  ATLAS_CASES.forEach((caseDefinition) => {
    assert.ok(caseDefinition.title)
    assert.ok(caseDefinition.purpose)
    assert.ok(caseDefinition.expectedResult)
    assert.ok(caseDefinition.guideIds.length > 0)
    assert.ok(caseDefinition.packages.length > 0)
    assert.ok(caseDefinition.actions.length > 0)
    assert.equal(
      new Set(caseDefinition.actions.map(({ id }) => id)).size,
      caseDefinition.actions.length
    )
  })
})

test('worker exposes only resettable protocol commands and public runtime adapter', async () => {
  const worker = await readFile(
    path.join(siteRoot, 'workers/runtime-atlas.worker.ts'),
    'utf8'
  )

  assert.match(worker, /createAtlasRun/)
  assert.match(worker, /advanceAtlasRun/)
  assert.match(worker, /caseId/)
  assert.match(worker, /'initialize'/)
  assert.match(worker, /'step'/)
  assert.match(worker, /'dispose'/)
  assert.doesNotMatch(worker, /packages\/.+\/src|\.\.\/\.\.\/\.\.\/packages/)
})

test('completed worker runs keep distinct identities across worker restarts', async () => {
  const runtime = await readFile(
    path.join(siteRoot, 'lib/runtime-atlas/runtime.mjs'),
    'utf8'
  )

  assert.match(runtime, /globalThis\.crypto\?\.randomUUID/)
  assert.match(runtime, /runId: createRunId\(\)/)
})
