/* global AbortController */
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const test = require('node:test')
const { spawn } = require('node:child_process')
const path = require('node:path')
const { runProcess, runnerEnvironment } = require('../runner.cjs')
const execute = (code, options = {}) =>
  runProcess({
    executable: process.execPath,
    args: ['-e', code],
    cwd: process.cwd(),
    env: {},
    ...options
  })

test('preserves a failing process exit instead of accepting its wrapper', async () => {
  const result = await execute('process.exit(7)')
  assert.equal(result.code, 7)
  assert.equal(result.reason, null)
})
test('a deadline settles an uncooperative process', async () => {
  const result = await execute(
    "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
    { timeoutMs: 150 }
  )
  assert.equal(result.reason, 'timeout')
  assert.throws(() => process.kill(result.pid, 0), { code: 'ESRCH' })
})
test('cancellation prevents pre-aborted admission and settles active execution', async () => {
  const controller = new AbortController()
  let spawns = 0
  controller.abort()
  const result = await execute('process.exit(0)', {
    signal: controller.signal,
    onSpawn: () => spawns++
  })
  assert.equal(result.reason, 'cancelled')
  assert.equal(spawns, 0)
  const running = new AbortController()
  const active = await execute('setInterval(() => {}, 1000)', {
    signal: running.signal,
    onSpawn: () => running.abort()
  })
  assert.equal(active.reason, 'cancelled')
  assert.throws(() => process.kill(active.pid, 0), { code: 'ESRCH' })
})
test('output is bounded and overflow cannot pass', async () => {
  const result = await execute(
    "setInterval(() => process.stdout.write('x'.repeat(4096)), 1)",
    { maxOutputBytes: 1024 }
  )
  assert.equal(result.reason, 'output-limit')
  assert.ok(Buffer.byteLength(result.output) <= 1024)
})
test('runner environment does not inherit credentials or Node injection', () => {
  assert.deepEqual(
    Object.keys(runnerEnvironment('/source', 'baseline', '/tmp')).sort(),
    ['CI', 'FLOW_PROOF_SCENARIO', 'FLOW_PROOF_SOURCE', 'LANG', 'PATH', 'TMPDIR']
  )
})
test('spawn failure is explicitly non-passing', async () => {
  const result = await runProcess({
    executable: '/does-not-exist',
    args: [],
    env: {}
  })
  assert.equal(result.reason, 'spawn-error')
})
test('an unexpected signal is an infrastructure failure', async () => {
  const result = await execute("process.kill(process.pid, 'SIGTERM')")
  assert.equal(result.reason, 'signal')
})
test('the owned runner group settles when its service abruptly dies', async () => {
  const runner = path.resolve(__dirname, '../runner.cjs')
  const payload = 'console.log(process.ppid); setInterval(() => {}, 1000)'
  const owner = spawn(
    process.execPath,
    [
      '-e',
      `require('node:child_process').spawn(process.execPath, [${JSON.stringify(runner)}, 'child', String(process.pid), '-e', ${JSON.stringify(payload)}], { detached: true, stdio: ['ignore', 'inherit', 'inherit'] }); setInterval(() => {}, 1000)`
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  )
  let group
  try {
    await new Promise((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Orphan runner did not settle')),
        5000
      )
      owner.stdout.once('data', (data) => {
        group = Number(data.toString().trim())
        owner.kill('SIGKILL')
      })
      owner.once('error', reject)
      // close waits for the inherited pipes held by both descendants.
      owner.once('close', () => {
        clearTimeout(deadline)
        resolve()
      })
    })
    assert.ok(Number.isInteger(group) && group > 0)
  } finally {
    owner.kill('SIGKILL')
    if (group) {
      try {
        process.kill(-group, 'SIGKILL')
      } catch (error) {
        assert.equal(error.code, 'ESRCH')
      }
    }
  }
})
