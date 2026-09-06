/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const { createRequire } = require('node:module')
const { setInterval, clearInterval } = require('node:timers')

function runProcess({
  executable,
  args,
  cwd,
  env,
  signal,
  timeoutMs = 30000,
  maxOutputBytes = 262144,
  onSpawn
}) {
  if (signal?.aborted)
    return Promise.resolve({
      code: null,
      reason: 'cancelled',
      output: '',
      pid: null
    })
  if (process.platform === 'win32')
    throw new Error(
      'The core proof runner requires macOS or Linux process groups'
    )
  return new Promise((resolve) => {
    let reason = null
    let output = ''
    let outputBytes = 0
    let forceTimer
    let spawnError
    const child = spawn(executable, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const kill = (signalName) => {
      if (!child.pid) return
      try {
        process.kill(-child.pid, signalName)
      } catch (error) {
        if (error.code !== 'ESRCH') spawnError = error.message
      }
    }
    const stop = (why) => {
      if (reason) return
      reason = why
      kill('SIGTERM')
      forceTimer = setTimeout(() => kill('SIGKILL'), 250)
    }
    const cancel = () => stop('cancelled')
    const timer = setTimeout(() => stop('timeout'), timeoutMs)
    signal?.addEventListener('abort', cancel, { once: true })
    child.once('spawn', () => {
      onSpawn?.(child.pid)
      if (signal?.aborted) cancel()
    })
    child.once('error', (error) => {
      spawnError = error.message
    })
    const collect = (bytes) => {
      const remaining = Math.max(0, maxOutputBytes - outputBytes)
      output += bytes.subarray(0, remaining).toString()
      outputBytes += bytes.length
      if (outputBytes > maxOutputBytes) stop('output-limit')
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.once('close', (code, exitSignal) => {
      clearTimeout(timer)
      clearTimeout(forceTimer)
      signal?.removeEventListener('abort', cancel)
      // Also settle descendants that outlived a successful leader.
      kill('SIGKILL')
      if (!reason && spawnError) reason = 'spawn-error'
      if (!reason && exitSignal) reason = 'signal'
      resolve({
        code,
        reason,
        error: spawnError,
        exitSignal,
        output,
        pid: child.pid ?? null
      })
    })
  })
}

function runnerEnvironment(sourceRoot, scenario, temporaryDirectory) {
  return {
    PATH: process.env.PATH ?? '',
    LANG: 'C.UTF-8',
    CI: 'true',
    TMPDIR: temporaryDirectory,
    FLOW_PROOF_SOURCE: sourceRoot,
    FLOW_PROOF_SCENARIO: scenario
  }
}

async function runVerification({
  repositoryRoot,
  runDirectory,
  snapshot,
  contract,
  scenario,
  flowIds,
  signal,
  timeoutMs,
  onSpawn
}) {
  if (!['baseline', 'inverse-regression'].includes(scenario))
    throw new Error('Unknown proof scenario')
  const requireFromRepository = createRequire(
    path.join(repositoryRoot, 'package.json')
  )
  const runnerPackage = requireFromRepository.resolve('vitest/package.json')
  const version = JSON.parse(fs.readFileSync(runnerPackage, 'utf8')).version
  const reportPath = path.join(runDirectory, 'vitest.json')
  const temporaryDirectory = path.join(runDirectory, 'tmp')
  fs.mkdirSync(temporaryDirectory, { recursive: true })
  const names = contract.cases
    .filter((item) => flowIds.includes(item.flowId))
    .map((item) => item.testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const result = await runProcess({
    executable: process.execPath,
    args: [
      __filename,
      'child',
      String(process.pid),
      path.join(path.dirname(runnerPackage), 'vitest.mjs'),
      'run',
      '--config',
      path.join(snapshot.sourceRoot, contract.configFile),
      '--reporter=json',
      '--outputFile=' + reportPath,
      '--testNamePattern=^(' + names.join('|') + ')$'
    ],
    cwd: repositoryRoot,
    env: runnerEnvironment(snapshot.sourceRoot, scenario, temporaryDirectory),
    signal,
    timeoutMs,
    onSpawn
  })
  let report = null
  let reportError = null
  try {
    if (fs.statSync(reportPath).size > 2097152)
      throw new Error('Runner report exceeds size limit')
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  } catch (error) {
    reportError = error.message
  }
  return { ...result, version, report, reportError, reportPath }
}

module.exports = { runProcess, runVerification, runnerEnvironment }

// The group leader also watches its owner: an abrupt server death must not
// leave a detached test tree running after the owner's deadline disappears.
if (require.main === module) {
  const [, , mode, owner, ...args] = process.argv
  if (mode !== 'child' || !/^\d+$/.test(owner ?? '') || !args.length)
    process.exit(2)
  const guard = setInterval(() => {
    if (process.ppid !== Number(owner)) process.kill(-process.pid, 'SIGKILL')
  }, 100)
  const child = spawn(process.execPath, args, { stdio: 'inherit' })
  child.once('error', () => {
    clearInterval(guard)
    process.exit(2)
  })
  child.once('close', (code, signal) => {
    clearInterval(guard)
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 2)
  })
}
