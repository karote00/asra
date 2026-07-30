import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'

import {
  attestEndpointBuildArtifact,
  attemptGuardedTermination,
  DEFAULT_RESOURCE_GUARD_CONFIG,
  buildBoundedResourceReport,
  buildEndpointPerformancePhases,
  buildRunnerSpawnOptions,
  createResourceGuardState,
  evaluateResourceSample,
  classifyGuardedChildExit,
  installTrackedProcessLifecycleGuard,
  parseRunnerArguments,
  recordProfileOutput,
  recordResourceHeartbeat,
  recordResourceSampleFailure,
  recordTrackedProcessGroupRegistration,
  runEndpointPerformancePipeline,
  runResourceGuardCli,
  runTrackedProcessLauncher,
  sampleTrackedProcessGroupsCpu,
  terminateTrackedProcessGroups,
  terminateTrackedProcessGroup,
  verifyTrackedProcessDescendant
} from '../e2e/performance-resource-guard.mjs'

const TARGET_PGID = 4242
const TOKEN = 'test-resource-guard-token'
const OWNER = 'admit-receiver-publication-frames'

const heartbeat = ({
  actorAElements = 0,
  actorBElements = 0,
  actorAComplete = false,
  actorBComplete = false,
  phase = 'creating',
  owner = OWNER,
  extra = {}
} = {}) => ({
  owner,
  phase,
  actorA: {
    canonicalElements: actorAElements,
    elements: actorAElements,
    renderProjectionElements: actorAElements,
    total: 7076,
    complete: actorAComplete,
    firstVisibleAtMs: actorAElements > 0 ? 150 : null
  },
  actorB: {
    canonicalElements: actorBElements,
    elements: actorBElements,
    renderProjectionElements: actorBElements,
    total: 7076,
    complete: actorBComplete,
    firstVisibleAtMs: actorBElements > 0 ? 220 : null
  },
  publications: {
    actorASent: 1,
    actorBApplied: actorBElements > 0 ? 1 : 0
  },
  ownerTiming: {
    actorADurationMs: 12,
    actorAPhase: 'factory:notify-shared-publication',
    actorBDurationMs: 8,
    actorBPhase: 'remote-apply'
  },
  ...extra
})

const record = (state, kind, nowMs, value = heartbeat()) =>
  recordResourceHeartbeat(
    state,
    {
      token: TOKEN,
      kind,
      heartbeat: value
    },
    {
      expectedToken: TOKEN,
      expectedOwner: OWNER,
      nowMs
    }
  )

const arm = (state, nowMs = 0) =>
  evaluateResourceSample(
    state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 0,
      nowMs
    },
    { targetPgid: TARGET_PGID }
  ).state

test('stops immediately when the tracked process group exceeds 150% CPU', () => {
  const state = createResourceGuardState({ nowMs: 0 })
  const result = evaluateResourceSample(
    state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 150.01,
      nowMs: 1_000
    },
    {
      targetPgid: TARGET_PGID,
      config: {
        maximumCpuPercent: 999,
        sampleIntervalMs: 1_000
      }
    }
  )

  assert.equal(result.accepted, true)
  assert.equal(result.decision.stop, true)
  assert.equal(result.decision.reason, 'cpu-limit-exceeded')
  assert.equal(DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent, 150)
  assert.equal(DEFAULT_RESOURCE_GUARD_CONFIG.sampleIntervalMs, 250)
  assert.equal(result.state.config.maximumCpuPercent, 150)
  assert.equal(result.state.config.sampleIntervalMs, 250)
})

test('allows every tracked process-group sample at or below 150% CPU', () => {
  let state = createResourceGuardState({ nowMs: 0 })

  for (let index = 0; index < 8; index += 1) {
    const result = evaluateResourceSample(
      state,
      {
        pgid: TARGET_PGID,
        cpuPercent: 150,
        nowMs: (index + 1) * 250
      },
      { targetPgid: TARGET_PGID }
    )
    assert.equal(result.decision.stop, false)
    state = result.state
  }
  assert.equal(state.cpuSamples.at(-1).cpuPercent, 150)
})

test('uses 200% only for an explicit root-cause diagnostic state', () => {
  const state = createResourceGuardState({
    nowMs: 0,
    config: {
      guardMode: 'diagnostic',
      maximumCpuPercent: 200
    }
  })
  const belowDiagnosticLimit = evaluateResourceSample(
    state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 175,
      nowMs: 250
    },
    { targetPgid: TARGET_PGID }
  )
  const aboveDiagnosticLimit = evaluateResourceSample(
    belowDiagnosticLimit.state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 200.01,
      nowMs: 500
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(belowDiagnosticLimit.state.config.guardMode, 'diagnostic')
  assert.equal(belowDiagnosticLimit.state.config.maximumCpuPercent, 200)
  assert.equal(belowDiagnosticLimit.decision.stop, false)
  assert.equal(aboveDiagnosticLimit.decision.reason, 'cpu-limit-exceeded')
})

test('stops when heartbeat is stale for more than ten seconds while CPU is above the ordinary 80% baseline', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const ready = record(arm(initial), 'ready', 0)
  assert.equal(ready.accepted, true)

  const result = evaluateResourceSample(
    ready.state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 81,
      nowMs: 10_001
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.decision.stop, true)
  assert.equal(result.decision.reason, 'heartbeat-stale')
})

test('stops on stalled A/B progress, but disables progress stall after both actors complete', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const armed = arm(initial)
  const ready = record(armed, 'ready', 0)
  const stalled = evaluateResourceSample(
    ready.state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 81,
      nowMs: 20_001
    },
    {
      targetPgid: TARGET_PGID,
      config: {
        ...DEFAULT_RESOURCE_GUARD_CONFIG,
        heartbeatStaleMs: 60_000
      }
    }
  )

  assert.equal(stalled.decision.stop, true)
  assert.equal(stalled.decision.reason, 'progress-stale')

  const completeReady = record(armed, 'ready', 0)
  const complete = record(
    completeReady.state,
    'complete',
    20_000,
    heartbeat({
      actorAElements: 7076,
      actorBElements: 7076,
      actorAComplete: true,
      actorBComplete: true,
      phase: 'complete',
      extra: {
        report: {
          actorA: {},
          actorB: {},
          owner: OWNER,
          status: 'complete'
        }
      }
    })
  )
  const afterComplete = evaluateResourceSample(
    complete.state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 81,
      nowMs: 40_001
    },
    {
      targetPgid: TARGET_PGID,
      config: {
        ...DEFAULT_RESOURCE_GUARD_CONFIG,
        heartbeatStaleMs: 60_000
      }
    }
  )

  assert.equal(afterComplete.decision.stop, false)
})

test('does not mistake stale activity for a host emergency at low CPU', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const ready = record(arm(initial), 'ready', 0)
  const result = evaluateResourceSample(
    ready.state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 80,
      nowMs: 60_000
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.decision.stop, false)
})

test('authenticates the ready heartbeat before accepting progress and allows bounded scalar evidence', () => {
  const initial = createResourceGuardState({ nowMs: 0 })

  const prematureProgress = record(initial, 'progress', 1)
  assert.equal(prematureProgress.accepted, false)
  assert.equal(prematureProgress.reason, 'guard-not-ready')

  const badToken = recordResourceHeartbeat(
    initial,
    {
      token: 'wrong',
      kind: 'ready',
      heartbeat: heartbeat()
    },
    {
      expectedToken: TOKEN,
      expectedOwner: OWNER,
      nowMs: 2
    }
  )
  assert.equal(badToken.accepted, false)
  assert.equal(badToken.reason, 'invalid-token')

  const wrongOwner = record(
    initial,
    'ready',
    3,
    heartbeat({ owner: 'another-owner' })
  )
  assert.equal(wrongOwner.accepted, false)
  assert.equal(wrongOwner.reason, 'invalid-owner')

  const unarmedReady = record(initial, 'ready', 4)
  assert.equal(unarmedReady.accepted, false)
  assert.equal(unarmedReady.reason, 'guard-not-armed')

  const ready = record(arm(initial, 4), 'ready', 4)
  assert.equal(ready.accepted, true)
  assert.equal(ready.state.ready, true)

  const progress = record(
    ready.state,
    'progress',
    5,
    heartbeat({
      actorAElements: 2048,
      actorBElements: 1024,
      extra: { undoDepth: 1, completeAtMs: null }
    })
  )
  assert.equal(progress.accepted, true)
  assert.equal(progress.state.lastHeartbeat.actorA.elements, 2048)

  const invalidKind = recordResourceHeartbeat(
    progress.state,
    {
      token: TOKEN,
      kind: 'unknown',
      heartbeat: heartbeat()
    },
    {
      expectedToken: TOKEN,
      expectedOwner: OWNER,
      nowMs: 6
    }
  )
  assert.equal(invalidKind.accepted, false)
  assert.equal(invalidKind.reason, 'invalid-kind')
})

test('accepts and reports an over-projected render count without hiding the excess', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const ready = record(arm(initial), 'ready', 0)
  const overProjected = record(
    ready.state,
    'progress',
    1_000,
    heartbeat({
      actorAElements: 7077,
      actorBElements: 7076,
      phase: 'peer-convergence'
    })
  )

  assert.equal(overProjected.accepted, true)
  const report = buildBoundedResourceReport(overProjected.state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })
  assert.equal(report.actorA.elements, 7077)
  assert.equal(report.actorA.total, 7076)
})

test('rejects a complete heartbeat unless both actors remain exactly complete', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const ready = record(arm(initial), 'ready', 0)
  const result = record(
    ready.state,
    'complete',
    1_000,
    heartbeat({
      actorAElements: 7076,
      actorBElements: 7077,
      actorAComplete: true,
      actorBComplete: true,
      phase: 'complete'
    })
  )

  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'incomplete-proof')
  assert.equal(result.state.finished, false)
})

test('takes the first tracked CPU sample before waiting for the sampling interval', async () => {
  const child = new EventEmitter()
  child.pid = TARGET_PGID
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.unref = () => undefined
  const runtimeProcess = new EventEmitter()
  let samples = 0
  const cadenceEvents = []
  const cleanedProcessGroups = []
  const intervalHandle = { unref: () => undefined }

  const result = await runResourceGuardCli(
    ['--owner', OWNER, '--', 'mock-command'],
    {
      baseEnv: {},
      requiresReady: false,
      runtimeProcess,
      sampleCpu: async (pgid) => {
        samples += 1
        cadenceEvents.push('sample')
        void Promise.resolve().then(() => child.emit('close', 0, null))
        return {
          cpuPercent: 1,
          nowMs: 1,
          pgid
        }
      },
      clearIntervalImpl: (handle) => {
        assert.equal(handle, intervalHandle)
      },
      setIntervalImpl: (_callback, milliseconds) => {
        cadenceEvents.push(`interval:${milliseconds}`)
        return intervalHandle
      },
      spawnImpl: () => child,
      terminate: async ({ pgid }) => {
        cleanedProcessGroups.push(pgid)
        return { forceKilled: false, pgid, termSent: false }
      },
      stdout: { write: () => true }
    }
  )

  assert.equal(samples, 1)
  assert.deepEqual(cadenceEvents, ['interval:250', 'sample'])
  assert.deepEqual(cleanedProcessGroups, [TARGET_PGID])
  assert.equal(result.report.termination.confirmed, true)
  assert.equal(result.exitCode, 0)
  assert.equal(runtimeProcess.listenerCount('SIGTERM'), 0)
})

test('fails closed and force-kills exact groups when child-close cleanup is unconfirmed', async () => {
  const child = new EventEmitter()
  child.pid = TARGET_PGID
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.unref = () => undefined
  const emergencyKills = []
  const intervalHandle = { unref: () => undefined }

  const result = await runResourceGuardCli(
    ['--owner', OWNER, '--', 'mock-command'],
    {
      baseEnv: {},
      clearIntervalImpl: () => undefined,
      emergencyKill: (pid, signal) => {
        emergencyKills.push([pid, signal])
      },
      fallbackTerminate: async () => {
        throw new Error('fallback cleanup failed')
      },
      requiresReady: false,
      runtimeProcess: new EventEmitter(),
      sampleCpu: async (pgid) => {
        void Promise.resolve().then(() => child.emit('close', 0, null))
        return {
          cpuPercent: 1,
          nowMs: 1,
          pgid
        }
      },
      setIntervalImpl: () => intervalHandle,
      spawnImpl: () => child,
      stdout: { write: () => true },
      terminate: async () => {
        throw new Error('primary cleanup failed')
      }
    }
  )

  assert.equal(result.exitCode, 86)
  assert.equal(result.report.stopReason, 'tracked-process-cleanup-failed')
  assert.deepEqual(emergencyKills, [[-TARGET_PGID, 'SIGKILL']])
  assert.equal(result.report.termination.confirmed, false)
})

test('treats cleanup work after a normal child close as a leaked process', async () => {
  const child = new EventEmitter()
  child.pid = TARGET_PGID
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.unref = () => undefined
  const intervalHandle = { unref: () => undefined }

  const result = await runResourceGuardCli(
    ['--owner', OWNER, '--', 'mock-command'],
    {
      baseEnv: {},
      clearIntervalImpl: () => undefined,
      requiresReady: false,
      runtimeProcess: new EventEmitter(),
      sampleCpu: async (pgid) => {
        void Promise.resolve().then(() => child.emit('close', 0, null))
        return {
          cpuPercent: 1,
          nowMs: 1,
          pgid
        }
      },
      setIntervalImpl: () => intervalHandle,
      spawnImpl: () => child,
      stdout: { write: () => true },
      terminate: async ({ pgid }) => ({
        forceKilled: false,
        pgid,
        termSent: true
      })
    }
  )

  assert.equal(result.exitCode, 86)
  assert.equal(
    result.report.stopReason,
    'tracked-process-leaked-after-child-close'
  )
})

test('force-kills exact groups when a guarded child does not close', async () => {
  const child = new EventEmitter()
  child.pid = TARGET_PGID
  child.stdout = Object.assign(new EventEmitter(), {
    destroy: () => undefined
  })
  child.stderr = Object.assign(new EventEmitter(), {
    destroy: () => undefined
  })
  child.unref = () => undefined
  const emergencyKills = []
  const intervalHandle = { unref: () => undefined }

  const result = await runResourceGuardCli(
    ['--owner', OWNER, '--', 'mock-command'],
    {
      baseEnv: {},
      clearIntervalImpl: () => undefined,
      config: { terminationGraceMs: 0 },
      emergencyKill: (pid, signal) => {
        emergencyKills.push([pid, signal])
      },
      requiresReady: false,
      runtimeProcess: new EventEmitter(),
      sampleCpu: async (pgid) => ({
        cpuPercent: 151,
        nowMs: 1,
        pgid
      }),
      setIntervalImpl: () => intervalHandle,
      spawnImpl: () => child,
      stdout: { write: () => true },
      terminate: async ({ pgid }) => ({
        forceKilled: true,
        pgid,
        termSent: true
      })
    }
  )

  assert.equal(result.exitCode, 86)
  assert.equal(result.report.childExit.error, 'child-close-timeout')
  assert.deepEqual(emergencyKills, [[-TARGET_PGID, 'SIGKILL']])
  assert.equal(result.report.termination.childCloseEmergency.confirmed, true)
})

test('forbids diagnostic CPU mode for an authenticated endpoint proof', async () => {
  const child = new EventEmitter()
  child.pid = TARGET_PGID
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.unref = () => undefined

  await assert.rejects(
    runResourceGuardCli(['--owner', OWNER, '--', 'mock-command'], {
      config: {
        guardMode: 'diagnostic',
        maximumCpuPercent: 200
      },
      requiresReady: true,
      runtimeProcess: new EventEmitter(),
      sampleCpu: async (pgid) => ({
        cpuPercent: 0,
        nowMs: 1,
        pgid
      }),
      spawnImpl: () => {
        queueMicrotask(() => child.emit('close', 0, null))
        return child
      },
      stdout: { write: () => true }
    }),
    /Diagnostic CPU mode cannot run an authenticated endpoint proof/u
  )
})

test('ignores CPU samples that do not belong to the spawned Playwright PGID', () => {
  const state = createResourceGuardState({ nowMs: 0 })
  const result = evaluateResourceSample(
    state,
    {
      pgid: TARGET_PGID + 1,
      cpuPercent: 2_000,
      nowMs: 1_000
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'untracked-process-group')
  assert.equal(result.decision.stop, false)
  assert.deepEqual(result.state.cpuSamples, [])
})

test('keeps only bounded heartbeat and CPU evidence in its emergency report', () => {
  const config = {
    ...DEFAULT_RESOURCE_GUARD_CONFIG,
    historyLimit: 3
  }
  let state = createResourceGuardState({ nowMs: 0, config })
  state = record(arm(state), 'ready', 0).state

  for (let index = 1; index <= 6; index += 1) {
    state = record(
      state,
      'progress',
      index * 1_000,
      heartbeat({
        actorAElements: index,
        actorBElements: index - 1,
        phase: `slice-${index}`
      })
    ).state
    state = evaluateResourceSample(
      state,
      {
        pgid: TARGET_PGID,
        cpuPercent: index === 1 ? 149 : 50 + index,
        nowMs: index * 1_000
      },
      { targetPgid: TARGET_PGID, config }
    ).state
  }

  const report = buildBoundedResourceReport(state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })

  assert.equal(report.heartbeats.length, 3)
  assert.equal(report.cpuSamples.length, 3)
  assert.equal(report.phase, 'slice-6')
  assert.equal(report.actorA.elements, 6)
  assert.equal(report.actorB.elements, 5)
  assert.deepEqual(report.maximumCpuSample, {
    pgid: TARGET_PGID,
    cpuPercent: 149,
    contributors: [],
    phase: 'slice-1',
    roleCpuPercent: {
      appServer: 0,
      clientBrowser: 0,
      testHarness: 0,
      unknown: 0,
      websocketServer: 0
    },
    sampledAtMs: 1_000
  })
  assert.equal(
    report.cpuSamples.some(({ sampledAtMs }) => sampledAtMs === 1_000),
    false
  )
  assert.deepEqual(report.ownerTiming, {
    actorADurationMs: 12,
    actorAPhase: 'factory:notify-shared-publication',
    actorBDurationMs: 8,
    actorBPhase: 'remote-apply'
  })
  assert.equal(JSON.stringify(report).includes(TOKEN), false)
})

test('keeps one bounded maximum CPU sample for each diagnostic phase', () => {
  let state = createResourceGuardState({ nowMs: 0 })
  state = record(arm(state), 'ready', 0).state

  for (let index = 1; index <= 30; index += 1) {
    state = record(
      state,
      'progress',
      index * 1_000,
      heartbeat({ phase: `phase-${index}` })
    ).state
    state = evaluateResourceSample(
      state,
      {
        pgid: TARGET_PGID,
        cpuPercent: index,
        nowMs: index * 1_000
      },
      { targetPgid: TARGET_PGID }
    ).state
  }

  state = evaluateResourceSample(
    state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 1,
      nowMs: 31_000
    },
    { targetPgid: TARGET_PGID }
  ).state

  const report = buildBoundedResourceReport(state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })

  assert.equal(report.phaseCpuMaximums.length, 24)
  assert.equal(report.phaseCpuMaximums[0].phase, 'phase-7')
  assert.equal(report.phaseCpuMaximums.at(-1).phase, 'phase-30')
  assert.equal(report.phaseCpuMaximums.at(-1).cpuPercent, 30)
})

test('samples every registered process group from one bounded OS snapshot', async () => {
  let receivedArguments
  let receivedOptions
  let snapshotCount = 0
  const processGroups = [
    { pgid: TARGET_PGID, role: 'test-harness' },
    { pgid: 5001, role: 'client-browser' },
    { pgid: 5002, role: 'app-server' },
    { pgid: 5003, role: 'websocket-server' }
  ]
  const result = await sampleTrackedProcessGroupsCpu(TARGET_PGID, {
    execFileImpl: (_file, arguments_, options, callback) => {
      snapshotCount += 1
      receivedArguments = arguments_
      receivedOptions = options
      callback(
        null,
        [
          `${TARGET_PGID} 1 ${TARGET_PGID} 12.0 node /repo/.yarn/releases/yarn-4.9.2.cjs playwright --guard-token=TOP-SECRET`,
          `5001 ${TARGET_PGID} 5001 91.0 /Applications/chrome-headless-shell --type=renderer`,
          `5002 ${TARGET_PGID} 5002 4.0 node node_modules/vite/bin/vite.js preview`,
          `5003 ${TARGET_PGID} 5003 18.0 node dist/collaboration-server/collaboration-server.js`,
          `6000 ${TARGET_PGID} 6000 999.0 node untracked.js`
        ].join('\n')
      )
    },
    nowMs: 1_000,
    platform: 'darwin',
    processGroups
  })

  assert.equal(snapshotCount, 1)
  assert.deepEqual(receivedArguments, [
    '-g',
    `${TARGET_PGID},5001,5002,5003`,
    '-o',
    'pid=,ppid=,pgid=,%cpu=,command='
  ])
  assert.equal(receivedOptions.timeout, 200)
  assert.equal(receivedOptions.killSignal, 'SIGKILL')
  assert.equal(receivedOptions.maxBuffer, 256 * 1024)
  assert.deepEqual(result, {
    contributors: [
      {
        cpuPercent: 91,
        executable: 'chrome-headless-shell',
        parentPid: TARGET_PGID,
        pgid: 5001,
        pid: 5001,
        role: 'client-browser'
      },
      {
        cpuPercent: 18,
        executable: 'node',
        parentPid: TARGET_PGID,
        pgid: 5003,
        pid: 5003,
        role: 'websocket-server'
      },
      {
        cpuPercent: 12,
        executable: 'yarn',
        parentPid: 1,
        pgid: TARGET_PGID,
        pid: TARGET_PGID,
        role: 'test-harness'
      },
      {
        cpuPercent: 4,
        executable: 'node',
        parentPid: TARGET_PGID,
        pgid: 5002,
        pid: 5002,
        role: 'app-server'
      }
    ],
    cpuPercent: 125,
    missingProcessRoles: [],
    nowMs: 1_000,
    pgid: TARGET_PGID,
    roleCpuPercent: {
      appServer: 4,
      clientBrowser: 91,
      testHarness: 12,
      unknown: 0,
      websocketServer: 18
    },
    trackedProcessRoles: [
      'test-harness',
      'client-browser',
      'app-server',
      'websocket-server'
    ]
  })
  assert.equal(JSON.stringify(result).includes('TOP-SECRET'), false)
})

test('fails closed when the bounded OS snapshot command fails', async () => {
  await assert.rejects(
    sampleTrackedProcessGroupsCpu(TARGET_PGID, {
      execFileImpl: (_file, _arguments, _options, callback) => {
        callback(
          Object.assign(new Error('process snapshot failed'), { code: 1 }),
          ''
        )
      },
      nowMs: 1_000,
      platform: 'darwin',
      processGroups: [{ pgid: TARGET_PGID, role: 'test-harness' }]
    }),
    /process snapshot failed/
  )
})

test('keeps bounded process contributors without weakening the aggregate CPU stop', () => {
  const state = createResourceGuardState({ nowMs: 0 })
  const result = evaluateResourceSample(
    state,
    {
      pgid: TARGET_PGID,
      cpuPercent: 151,
      nowMs: 1_000,
      contributors: [
        {
          pid: TARGET_PGID + 5,
          parentPid: TARGET_PGID,
          cpuPercent: 5,
          executable: '/usr/local/bin/node',
          argv: `--token=${TOKEN}`
        },
        {
          pid: TARGET_PGID + 1,
          parentPid: TARGET_PGID,
          cpuPercent: 45,
          executable: '/usr/local/bin/node'
        },
        {
          pid: TARGET_PGID + 2,
          parentPid: TARGET_PGID,
          cpuPercent: 35,
          executable: '/usr/local/bin/esbuild'
        },
        {
          pid: TARGET_PGID + 3,
          parentPid: TARGET_PGID,
          cpuPercent: 25,
          executable: '/Applications/Chrome Headless Shell'
        },
        {
          pid: TARGET_PGID,
          parentPid: 1,
          cpuPercent: 20,
          executable: '/usr/local/bin/yarn'
        },
        {
          pid: -1,
          parentPid: TARGET_PGID,
          cpuPercent: 999,
          executable: '/invalid'
        },
        {
          pid: TARGET_PGID + 6,
          parentPid: TARGET_PGID,
          cpuPercent: 21,
          executable: ''
        }
      ]
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.accepted, true)
  assert.equal(result.decision.reason, 'cpu-limit-exceeded')
  assert.deepEqual(result.state.cpuSamples[0].contributors, [
    {
      pid: TARGET_PGID + 1,
      parentPid: TARGET_PGID,
      cpuPercent: 45,
      executable: '/usr/local/bin/node'
    },
    {
      pid: TARGET_PGID + 2,
      parentPid: TARGET_PGID,
      cpuPercent: 35,
      executable: '/usr/local/bin/esbuild'
    },
    {
      pid: TARGET_PGID + 3,
      parentPid: TARGET_PGID,
      cpuPercent: 25,
      executable: '/Applications/Chrome Headless Shell'
    },
    {
      pid: TARGET_PGID,
      parentPid: 1,
      cpuPercent: 20,
      executable: '/usr/local/bin/yarn'
    }
  ])
  assert.equal(JSON.stringify(result.state.cpuSamples).includes(TOKEN), false)
})

test('terminates the tracked group when the guard receives a signal or exits unexpectedly', async () => {
  const runtimeProcess = new EventEmitter()
  const terminations = []
  const emergencyKills = []
  const dispose = installTrackedProcessLifecycleGuard({
    pgid: TARGET_PGID,
    runtimeProcess,
    startTermination: async (reason) => {
      terminations.push(reason)
    },
    emergencyKill: (pid, signal) => {
      emergencyKills.push([pid, signal])
    }
  })

  runtimeProcess.emit('SIGTERM')
  await Promise.resolve()
  assert.deepEqual(terminations, ['SIGTERM'])

  runtimeProcess.emit('exit')
  assert.deepEqual(emergencyKills, [[-TARGET_PGID, 'SIGKILL']])

  dispose()
  assert.equal(runtimeProcess.listenerCount('SIGINT'), 0)
  assert.equal(runtimeProcess.listenerCount('SIGTERM'), 0)
  assert.equal(runtimeProcess.listenerCount('SIGHUP'), 0)
  assert.equal(runtimeProcess.listenerCount('exit'), 0)
})

test('terminates only the tracked process group, waits at most three seconds, and force-kills only survivors', async () => {
  const calls = []
  const result = await terminateTrackedProcessGroup({
    pgid: TARGET_PGID,
    graceMs: 30_000,
    kill: async (pid, signal) => {
      calls.push(['kill', pid, signal])
    },
    wait: async (milliseconds) => {
      calls.push(['wait', milliseconds])
    },
    probe: async (pgid) => {
      calls.push(['probe', pgid])
      return true
    }
  })

  assert.deepEqual(calls, [
    ['kill', -TARGET_PGID, 'SIGTERM'],
    ['wait', 3_000],
    ['probe', TARGET_PGID],
    ['kill', -TARGET_PGID, 'SIGKILL']
  ])
  assert.deepEqual(result, {
    pgid: TARGET_PGID,
    termSent: true,
    forceKilled: true
  })

  const survivorGoneCalls = []
  const survivorGone = await terminateTrackedProcessGroup({
    pgid: TARGET_PGID,
    kill: async (pid, signal) => {
      survivorGoneCalls.push(['kill', pid, signal])
    },
    wait: async () => undefined,
    probe: async () => false
  })
  assert.equal(survivorGone.forceKilled, false)
  assert.deepEqual(survivorGoneCalls, [['kill', -TARGET_PGID, 'SIGTERM']])
})

test('bounds termination failures and falls back to the project-owned process-group terminator', async () => {
  const calls = []
  const recovered = await attemptGuardedTermination({
    pgid: TARGET_PGID,
    graceMs: 3_000,
    terminate: async () => {
      calls.push('primary')
      throw new Error('primary termination failed')
    },
    fallbackTerminate: async ({ pgid, graceMs }) => {
      calls.push(['fallback', pgid, graceMs])
      return { pgid, termSent: true, forceKilled: true }
    }
  })

  assert.deepEqual(calls, ['primary', ['fallback', TARGET_PGID, 0]])
  assert.equal(recovered.confirmed, true)
  assert.equal(recovered.failures.length, 1)

  const unconfirmed = await attemptGuardedTermination({
    pgid: TARGET_PGID,
    graceMs: 3_000,
    terminate: async () => {
      throw new Error('primary termination failed')
    },
    fallbackTerminate: async () => {
      throw new Error('fallback termination failed')
    }
  })
  assert.equal(unconfirmed.confirmed, false)
  assert.equal(unconfirmed.failures.length, 2)
})

test('builds a detached, shell-free runner command with the fixed guard environment', () => {
  const parsed = parseRunnerArguments([
    '--owner',
    OWNER,
    '--',
    'yarn',
    'playwright',
    'test',
    'e2e/crdt-endpoint-performance.spec.ts',
    '--workers=1'
  ])

  assert.deepEqual(parsed, {
    owner: OWNER,
    command: 'yarn',
    args: [
      'playwright',
      'test',
      'e2e/crdt-endpoint-performance.spec.ts',
      '--workers=1'
    ]
  })

  const options = buildRunnerSpawnOptions({
    owner: OWNER,
    guardUrl: 'http://127.0.0.1:54321',
    guardToken: TOKEN,
    baseEnv: { PATH: '/test/bin' }
  })

  assert.equal(options.detached, true)
  assert.equal(options.shell, false)
  assert.equal(options.env.ASYRA_DESIGN_ENDPOINT_OWNER, OWNER)
  assert.equal(
    options.env.ASYRA_DESIGN_ENDPOINT_GUARD_URL,
    'http://127.0.0.1:54321'
  )
  assert.equal(options.env.ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN, TOKEN)
})

test('plans collaboration build, app build, and Playwright as guarded sequential phases', () => {
  const phases = buildEndpointPerformancePhases({
    owner: OWNER,
    baseEnv: {
      ASYRA_DESIGN_ENDPOINT_CONNECTIVITY_ONLY: '1',
      PATH: '/test/bin'
    }
  })

  assert.deepEqual(
    phases.map((phase) => phase.name),
    ['collaboration-build', 'app-build', 'playwright']
  )
  assert.deepEqual(
    phases.map((phase) => phase.guardConfig),
    [
      { guardMode: 'diagnostic', maximumCpuPercent: 200 },
      { guardMode: 'diagnostic', maximumCpuPercent: 200 },
      {
        guardMode: 'proof',
        maximumCpuPercent: 150,
        requiredProcessRoles: [
          'test-harness',
          'client-browser',
          'app-server',
          'websocket-server'
        ]
      }
    ]
  )
  assert.deepEqual(phases[0].argv, [
    '--owner',
    `${OWNER}:collaboration-build`,
    '--',
    'yarn',
    'build:collaboration-server'
  ])
  assert.deepEqual(phases[1].argv, [
    '--owner',
    `${OWNER}:app-build`,
    '--',
    'yarn',
    'react:build'
  ])
  assert.deepEqual(phases[2].argv, [
    '--owner',
    OWNER,
    '--',
    'yarn',
    'playwright',
    'test',
    '--config',
    'playwright.endpoint-performance.config.ts',
    '--workers=1'
  ])
  assert.equal(
    phases[1].baseEnv.VITE_ASYRA_DESIGN_COLLABORATION_WS_URL,
    'ws://127.0.0.1:4121/asyra-design-collaboration'
  )
  assert.equal(phases[1].baseEnv.GOMAXPROCS, '1')
  assert.equal(phases[1].baseEnv.NODE_OPTIONS, '--v8-pool-size=1')
  assert.equal(phases[1].baseEnv.UV_THREADPOOL_SIZE, '1')
  assert.equal(phases[0].baseEnv.GOMAXPROCS, undefined)
  assert.equal(phases[2].baseEnv.GOMAXPROCS, undefined)
  assert.equal(phases[2].baseEnv.NODE_OPTIONS, undefined)
  assert.equal(phases[2].baseEnv.UV_THREADPOOL_SIZE, undefined)
  assert.equal(phases[2].baseEnv.ASYRA_DESIGN_APP_URL, 'http://127.0.0.1:3021')
  assert.equal(phases[2].baseEnv.ASYRA_DESIGN_COLLABORATION_WS_PORT, '4121')
  assert.equal(phases[2].baseEnv.ASYRA_DESIGN_ENDPOINT_CONNECTIVITY_ONLY, '0')
})

test('attests that the emitted production artifact owns exactly the endpoint used by the proof', async () => {
  const expectedEndpoint = 'ws://127.0.0.1:4121/asyra-design-collaboration'
  const assets = new Map([
    [
      'index-current.js',
      `const endpoint="${expectedEndpoint}"; export { endpoint }`
    ],
    ['worker-current.js', 'self.addEventListener("message", () => undefined)']
  ])
  let activeReads = 0
  let maximumActiveReads = 0
  const options = {
    assetsDirectory: '/project/dist/assets',
    expectedEndpoint,
    readdirImpl: async () => [...assets.keys(), 'index.css'],
    readFileImpl: async (file) => {
      activeReads += 1
      maximumActiveReads = Math.max(maximumActiveReads, activeReads)
      await new Promise((resolveRead) => queueMicrotask(resolveRead))
      const source = assets.get(file.split('/').at(-1))
      activeReads -= 1
      return source
    }
  }

  assert.deepEqual(await attestEndpointBuildArtifact(options), {
    assetsInspected: 2,
    endpoint: expectedEndpoint
  })
  assert.equal(maximumActiveReads, 1)

  assets.set(
    'index-current.js',
    'const endpoint="ws://127.0.0.1:4101/asyra-design-collaboration"'
  )
  await assert.rejects(
    attestEndpointBuildArtifact(options),
    /production artifact endpoint mismatch.*4101.*4121/i
  )
})

test('requires one authenticated descendant process group for every proof role before ready', () => {
  const requiredProcessRoles = [
    'test-harness',
    'client-browser',
    'app-server',
    'websocket-server'
  ]
  let state = createResourceGuardState({
    nowMs: 0,
    config: { requiredProcessRoles }
  })
  const register = (
    role,
    pgid,
    { descendantVerified = true, owner = OWNER, token = TOKEN } = {}
  ) => {
    const result = recordTrackedProcessGroupRegistration(
      state,
      { owner, pgid, pid: pgid, role, token },
      {
        descendantVerified,
        expectedOwner: OWNER,
        expectedToken: TOKEN,
        rootPgid: TARGET_PGID
      }
    )
    state = result.state
    return result
  }

  assert.equal(register('test-harness', TARGET_PGID).accepted, true)
  assert.equal(register('client-browser', 5001).accepted, true)
  assert.equal(
    register('app-server', 5002, { token: 'wrong-token' }).reason,
    'invalid-token'
  )
  assert.equal(
    register('app-server', 5002, { owner: 'foreign-owner' }).reason,
    'invalid-owner'
  )
  assert.equal(
    register('app-server', 5002, { descendantVerified: false }).reason,
    'unverified-descendant'
  )

  const armed = arm(state)
  const beforeAllRoles = record(armed, 'ready', 1)
  assert.equal(beforeAllRoles.accepted, false)
  assert.equal(beforeAllRoles.reason, 'process-groups-not-ready')

  state = armed
  assert.equal(register('app-server', 5002).accepted, true)
  assert.equal(register('websocket-server', 5003).accepted, true)
  const idempotentBrowser = register('client-browser', 5001)
  assert.equal(idempotentBrowser.accepted, true)
  assert.equal(idempotentBrowser.state.processGroups.length, 4)
  assert.equal(register('client-browser', 5999).reason, 'role-conflict')
  assert.equal(
    recordTrackedProcessGroupRegistration(
      state,
      {
        owner: OWNER,
        pgid: 6001,
        pid: 6000,
        role: 'client-browser',
        token: TOKEN
      },
      {
        descendantVerified: true,
        expectedOwner: OWNER,
        expectedToken: TOKEN,
        rootPgid: TARGET_PGID
      }
    ).reason,
    'invalid-process-group'
  )

  const beforeRoleSample = record(state, 'ready', 2)
  assert.equal(beforeRoleSample.accepted, false)
  assert.equal(beforeRoleSample.reason, 'process-groups-not-sampled')
  state = evaluateResourceSample(
    state,
    {
      cpuPercent: 0,
      nowMs: 3,
      pgid: TARGET_PGID,
      trackedProcessRoles: requiredProcessRoles
    },
    { targetPgid: TARGET_PGID }
  ).state
  const ready = record(state, 'ready', 4)
  assert.equal(ready.accepted, true)

  const stopping = evaluateResourceSample(
    state,
    {
      cpuPercent: 151,
      nowMs: 5,
      pgid: TARGET_PGID,
      trackedProcessRoles: requiredProcessRoles
    },
    { targetPgid: TARGET_PGID }
  ).state
  assert.equal(
    recordTrackedProcessGroupRegistration(
      stopping,
      {
        owner: OWNER,
        pgid: 7001,
        pid: 7001,
        role: 'app-server',
        token: TOKEN
      },
      {
        descendantVerified: true,
        expectedOwner: OWNER,
        expectedToken: TOKEN,
        rootPgid: TARGET_PGID
      }
    ).reason,
    'guard-stopping'
  )
})

test('stops when a registered process role disappears before proof completion', async () => {
  const processGroups = [
    { pgid: TARGET_PGID, role: 'test-harness' },
    { pgid: 5001, role: 'client-browser' },
    { pgid: 5002, role: 'app-server' },
    { pgid: 5003, role: 'websocket-server' }
  ]
  const sampled = await sampleTrackedProcessGroupsCpu(TARGET_PGID, {
    execFileImpl: (_file, _arguments, _options, callback) => {
      callback(
        null,
        [
          `${TARGET_PGID} 1 ${TARGET_PGID} 12.0 yarn playwright`,
          `5001 ${TARGET_PGID} 5001 40.0 chrome-headless-shell`,
          `5002 ${TARGET_PGID} 5002 4.0 node vite preview`
        ].join('\n')
      )
    },
    nowMs: 1_000,
    platform: 'darwin',
    processGroups
  })

  assert.deepEqual(sampled.missingProcessRoles, ['websocket-server'])
  assert.deepEqual(sampled.trackedProcessRoles, [
    'test-harness',
    'client-browser',
    'app-server'
  ])
  const evaluated = evaluateResourceSample(
    createResourceGuardState({
      config: {
        requiredProcessRoles: processGroups.map(({ role }) => role)
      },
      nowMs: 0
    }),
    sampled,
    { targetPgid: TARGET_PGID }
  )
  assert.equal(evaluated.decision.stop, true)
  assert.equal(evaluated.decision.reason, 'tracked-process-group-missing')

  const diagnostic = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    sampled,
    { targetPgid: TARGET_PGID }
  )
  assert.equal(diagnostic.decision.stop, false)
})

test('verifies one fixed process group through its bounded parent chain', async () => {
  const identities = new Map([
    [5001, { parentPid: 4900, pgid: 5001, pid: 5001 }],
    [4900, { parentPid: TARGET_PGID, pgid: TARGET_PGID, pid: 4900 }],
    [TARGET_PGID, { parentPid: 1, pgid: TARGET_PGID, pid: TARGET_PGID }]
  ])
  const readIdentity = async (pid) => identities.get(pid) ?? null

  assert.equal(
    await verifyTrackedProcessDescendant(
      { pgid: 5001, pid: 5001, rootPgid: TARGET_PGID },
      { readIdentity }
    ),
    true
  )
  assert.equal(
    await verifyTrackedProcessDescendant(
      { pgid: 5002, pid: 5001, rootPgid: TARGET_PGID },
      { readIdentity }
    ),
    false
  )
  identities.set(4900, { parentPid: 1, pgid: TARGET_PGID, pid: 4900 })
  assert.equal(
    await verifyTrackedProcessDescendant(
      { pgid: 5001, pid: 5001, rootPgid: TARGET_PGID },
      { readIdentity }
    ),
    false
  )
})

test('registers a tracked launcher before spawn and removes guard secrets from its child', async () => {
  const requests = []
  let spawnCall
  const child = new EventEmitter()
  const execution = runTrackedProcessLauncher(
    ['--tracked-role', 'app-server', '--', 'yarn', 'preview', '--port', '3021'],
    {
      baseEnv: {
        ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED:
          'ws://127.0.0.1:4121/asyra-design-collaboration',
        ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN: TOKEN,
        ASYRA_DESIGN_ENDPOINT_GUARD_URL: 'http://127.0.0.1:4319',
        ASYRA_DESIGN_ENDPOINT_OWNER: OWNER,
        KEEP_ME: 'yes'
      },
      fetchImpl: async (url, options) => {
        requests.push({
          body: JSON.parse(options.body),
          url
        })
        return {
          ok: true,
          json: async () => ({ accepted: true }),
          status: 200
        }
      },
      runtimeProcess: { pid: 5002 },
      spawnImpl: (command, args, options) => {
        spawnCall = { args, command, options }
        queueMicrotask(() => child.emit('close', 0, null))
        return child
      }
    }
  )

  assert.deepEqual(await execution, { exitCode: 0, signal: null })
  assert.deepEqual(requests, [
    {
      body: {
        owner: OWNER,
        pgid: 5002,
        pid: 5002,
        role: 'app-server',
        token: TOKEN
      },
      url: 'http://127.0.0.1:4319/register-process-group'
    }
  ])
  assert.equal(spawnCall.command, 'yarn')
  assert.deepEqual(spawnCall.args, ['preview', '--port', '3021'])
  assert.equal(spawnCall.options.detached, false)
  assert.equal(spawnCall.options.shell, false)
  assert.equal(spawnCall.options.env.KEEP_ME, 'yes')
  assert.equal(
    spawnCall.options.env.ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN,
    undefined
  )
  assert.equal(spawnCall.options.env.ASYRA_DESIGN_ENDPOINT_GUARD_URL, undefined)
  assert.equal(spawnCall.options.env.ASYRA_DESIGN_ENDPOINT_OWNER, undefined)
})

test('starts product-group termination before root within one bounded window', async () => {
  const processGroups = [
    { pgid: TARGET_PGID, role: 'test-harness' },
    { pgid: 5001, role: 'client-browser' },
    { pgid: 5002, role: 'app-server' },
    { pgid: 5003, role: 'websocket-server' }
  ]
  const started = []
  const result = await terminateTrackedProcessGroups({
    graceMs: 3_000,
    processGroups,
    terminate: async ({ pgid }) => {
      started.push(pgid)
      return { forceKilled: false, pgid, termSent: true }
    }
  })

  assert.deepEqual(
    started.slice(0, 3).sort((a, b) => a - b),
    [5001, 5002, 5003]
  )
  assert.equal(started.at(-1), TARGET_PGID)
  assert.equal(result.confirmed, true)
  assert.equal(result.groups.length, 4)
})

test('attests the app build before starting Playwright and passes the bounded artifact claim', async () => {
  const events = []
  const expectedEndpoint = 'ws://127.0.0.1:4121/asyra-design-collaboration'
  const result = await runEndpointPerformancePipeline(['--owner', OWNER], {
    assertPortAvailable: async (port) => {
      events.push(`port:${port}`)
    },
    attestBuild: async ({ expectedEndpoint: actualEndpoint }) => {
      assert.equal(actualEndpoint, expectedEndpoint)
      events.push('attest-build')
      return { assetsInspected: 2, endpoint: actualEndpoint }
    },
    baseEnv: { PATH: '/test/bin' },
    runPhase: async (argv, options) => {
      const phaseOwner = argv[1]
      events.push(`phase:${phaseOwner}`)
      if (phaseOwner === OWNER) {
        assert.equal(
          options.baseEnv.ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED,
          expectedEndpoint
        )
      }
      return {
        exitCode: 0,
        report: { owner: phaseOwner }
      }
    }
  })

  assert.equal(result.exitCode, 0)
  assert.deepEqual(events, [
    'port:3021',
    'port:4121',
    `phase:${OWNER}:collaboration-build`,
    `phase:${OWNER}:app-build`,
    'attest-build',
    `phase:${OWNER}`
  ])
})

test('turns process sampling failure into an immediate stop decision', () => {
  const state = createResourceGuardState({ nowMs: 0 })
  const samplingError = Object.assign(
    new Error('Command failed: ps -Ao pid=,ppid=,pgid=,%cpu=,comm='),
    {
      code: null,
      killed: true,
      signal: 'SIGKILL'
    }
  )
  const failed = recordResourceSampleFailure(state, {
    targetPgid: TARGET_PGID,
    nowMs: 1_000,
    error: samplingError
  })

  assert.equal(failed.decision.stop, true)
  assert.equal(failed.decision.reason, 'resource-sample-failed')
  assert.deepEqual(failed.state.sampleFailure, {
    pgid: TARGET_PGID,
    atMs: 1_000,
    errorCode: null,
    killed: true,
    message: 'Command failed: ps -Ao pid=,ppid=,pgid=,%cpu=,comm=',
    signal: 'SIGKILL',
    timeoutMs: 200
  })
})

test('fails a successful child exit when a guarded Playwright spec never became ready', () => {
  const state = createResourceGuardState({ nowMs: 0 })
  const result = classifyGuardedChildExit(
    state,
    { code: 0, signal: null, error: null },
    { requiresReady: true, nowMs: 1_000 }
  )

  assert.equal(result.ok, false)
  assert.equal(result.state.stopDecision.reason, 'guard-never-ready')

  const buildResult = classifyGuardedChildExit(
    state,
    { code: 0, signal: null, error: null },
    { requiresReady: false, nowMs: 1_000 }
  )
  assert.equal(buildResult.ok, true)
})

test('fails a successful guarded child exit without one accepted complete proof', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const ready = record(arm(initial), 'ready', 0)
  const result = classifyGuardedChildExit(
    ready.state,
    { code: 0, signal: null, error: null },
    { requiresReady: true, nowMs: 1_000 }
  )

  assert.equal(result.ok, false)
  assert.equal(result.state.stopDecision.reason, 'guard-never-complete')
})

test('aggregates bounded collaboration profile metrics into the final report', () => {
  const config = {
    ...DEFAULT_RESOURCE_GUARD_CONFIG,
    historyLimit: 2
  }
  let state = createResourceGuardState({ nowMs: 0, config })
  state = recordProfileOutput(
    state,
    [
      'AI_COLLABORATION_SERVER_PEER_WRITE {"writeCallbackMs":1.25,"queueBytes":1024}',
      'AI_COLLABORATION_SERVER_PEER_DRAIN {"drainMs":9.5,"queueBytes":512}',
      'AI_COLLABORATION_SERVER_PROFILE {"queueWaitMs":4.25,"totalMs":12.75}',
      'AI_COLLABORATION_SERVER_PEER_APPLIED {"publicationId":"pub-1","applyMs":7.5}',
      ''
    ].join('\n')
  )

  const report = buildBoundedResourceReport(state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })

  assert.deepEqual(report.profileMetrics.counts, {
    profile: 1,
    peerWrite: 1,
    peerDrain: 1,
    peerApplied: 1
  })
  assert.equal(report.profileMetrics.maximums.writeCallbackMs, 1.25)
  assert.equal(report.profileMetrics.maximums.drainMs, 9.5)
  assert.equal(report.profileMetrics.maximums.queueWaitMs, 4.25)
  assert.equal(report.profileMetrics.maximums.totalMs, 12.75)
  assert.equal(report.profileMetrics.maximums.queueBytes, 1024)
  assert.equal(report.profileMetrics.recent.length, 2)
})

test('retains only bounded canonical and owner-timing evidence from a completed endpoint report', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const ready = record(arm(initial), 'ready', 0)
  const completed = record(
    ready.state,
    'complete',
    2_000,
    heartbeat({
      actorAElements: 7076,
      actorBElements: 7076,
      actorAComplete: true,
      actorBComplete: true,
      phase: 'complete',
      extra: {
        elapsedMs: 2_000,
        report: {
          actorA: {
            completeMs: 1_000,
            diagnostics: {
              topPhases: Array.from({ length: 40 }, (_, index) => ({
                durationMs: index + 0.5,
                name: `actor-a-phase-${index}`
              }))
            },
            firstVisibleMs: 100,
            summary: {
              canonicalSha256: 'actor-a-canonical',
              pointCount: 115_000,
              totalCount: 7076,
              whiteBackgrounds: [{ height: 941, id: 'background', width: 1672 }]
            }
          },
          actorB: {
            completeMs: 1_800,
            diagnostics: {
              topPhases: [{ durationMs: 750.25, name: 'remote-apply' }]
            },
            firstVisibleMs: 200,
            summary: {
              canonicalSha256: 'actor-a-canonical',
              pointCount: 115_000,
              totalCount: 7076,
              whiteBackgrounds: [{ height: 941, id: 'background', width: 1672 }]
            }
          },
          convergedMs: 1_800,
          durationMs: 2_000,
          owner: OWNER,
          status: 'complete',
          ignoredPayload: Array.from({ length: 10_000 }, () => 'drop-me')
        }
      }
    })
  )
  const report = buildBoundedResourceReport(completed.state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })

  assert.equal(report.endpointReport.owner, OWNER)
  assert.equal(report.endpointReport.durationMs, 2_000)
  assert.equal(report.endpointReport.actorA.summary.pointCount, 115_000)
  assert.deepEqual(report.endpointReport.actorB.summary.whiteBackgrounds, [
    { height: 941, id: 'background', width: 1672 }
  ])
  assert.equal(report.endpointReport.actorA.diagnostics.topPhases.length, 24)
  assert.equal(Object.hasOwn(report.endpointReport, 'ignoredPayload'), false)
})
