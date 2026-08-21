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

test('continuous pointer settles three updates as one Undo unit', async () => {
  const result = await runIsolatedCase('continuous-pointer-undo')

  assert.equal(result.status, 'succeeded')
  assert.equal(result.result.canonicalValue, 5)
  assert.equal(result.result.undoDepth, 1)
  assert.equal(result.result.undoValue, 0)
  assert.equal(result.result.redoValue, 5)
})

test('one canonical mutation fans out to four App-owned projections', async () => {
  const result = await runIsolatedCase('canonical-projection-fanout')

  assert.equal(result.status, 'succeeded')
  assert.equal(result.result.canonical.status, 'approved')
  assert.deepEqual(Object.keys(result.result.projections).sort(), [
    'canvas',
    'hierarchy',
    'properties',
    'serialization'
  ])
})

test('invalid input rolls back the complete preview without history', async () => {
  const result = await runIsolatedCase('invalid-input-rollback')

  assert.equal(result.status, 'rejected')
  assert.equal(result.result.canonicalValue, 5)
  assert.equal(result.result.undoDepth, 0)
  assert.match(result.result.failure, /greater than or equal to zero/i)
})
