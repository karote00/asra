import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import process from 'node:process'
import { URL } from 'node:url'
import { promisify } from 'node:util'
import test from 'node:test'

const execute = promisify(execFile)

const runIsolatedCase = async (caseId) => {
  const runtimeUrl = new URL(
    '../lib/runtime-atlas/runtime.mjs',
    import.meta.url
  )
  const script = `
    import { runCaseToCompletion } from ${JSON.stringify(runtimeUrl.href)};
    const result = await runCaseToCompletion(${JSON.stringify(caseId)});
    process.stdout.write(JSON.stringify(result));
  `
  const { stdout } = await execute(process.execPath, [
    '--input-type=module',
    '--eval',
    script
  ])
  return JSON.parse(stdout)
}

test('two in-browser actors converge through MemoryProvider transport', async () => {
  const result = await runIsolatedCase('collaboration-two-actors')

  assert.equal(result.status, 'succeeded')
  assert.equal(result.result.actorA, 7)
  assert.equal(result.result.actorB, 7)
  assert.equal(result.result.durable, false)
  assert.equal(result.result.awarenessCanonical, false)
})

test('AI runtime executes one registered action through app transaction policy', async () => {
  const result = await runIsolatedCase('ai-registered-action')

  assert.equal(result.status, 'succeeded')
  assert.equal(result.result.visible, false)
  assert.equal(result.result.transactionCount, 1)
  assert.equal(result.result.providerKind, 'deterministic-app-provider')
})

test('retrieval stays read-only and mutation uses registered Feature API', async () => {
  const result = await runIsolatedCase('machine-retrieval-action')

  assert.equal(result.status, 'succeeded')
  assert.equal(result.result.matches.length, 1)
  assert.equal(result.result.retrievalChangedCanonical, false)
  assert.equal(result.result.records['record-b'].status, 'approved')
  assert.equal(result.result.runtimeBoundary, 'browser/Core composition')
})
