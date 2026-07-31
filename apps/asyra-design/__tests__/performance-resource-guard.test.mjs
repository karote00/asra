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
  createSerializedResourceSampler,
  createResourceGuardState,
  deriveProcessCpuTimeDelta,
  evaluateResourceSample,
  classifyGuardedChildExit,
  installTrackedProcessLifecycleGuard,
  parseCpuTimeToMilliseconds,
  parseRunnerArguments,
  recordGuardedResourcePhaseBoundary,
  recordProfileOutput,
  recordResourcePhaseBoundary,
  recordResourceHeartbeat,
  recordResourceSampleFailure,
  recordTrackedProcessGroupRegistration,
  runEndpointPerformancePipeline,
  runResourceGuardCli,
  runTrackedProcessLauncher,
  sampleTrackedProcessGroupsCpu,
  summarizeRendererPerformanceWindow,
  terminateTrackedProcessGroups,
  terminateTrackedProcessGroup,
  verifyTrackedProcessDescendant
} from '../e2e/performance-resource-guard.mjs'

const TARGET_PGID = 4242
const TOKEN = 'test-resource-guard-token'
const OWNER = 'admit-receiver-publication-frames'

test('parses cumulative process CPU time without treating it as decayed percent', () => {
  assert.equal(parseCpuTimeToMilliseconds('0:00.01'), 10)
  assert.equal(parseCpuTimeToMilliseconds('1:02.34'), 62_340)
  assert.equal(parseCpuTimeToMilliseconds('2:03:04.56'), 7_384_560)
  assert.equal(parseCpuTimeToMilliseconds('1-02:03:04.56'), 93_784_560)
  assert.throws(
    () => parseCpuTimeToMilliseconds('not-a-time'),
    /process CPU time/i
  )
})

test('reports one renderer operation or idle window from cumulative CDP metrics', () => {
  const start = {
    metrics: [
      { name: 'Timestamp', value: 10 },
      { name: 'TaskDuration', value: 0.5 },
      { name: 'ScriptDuration', value: 0.2 },
      { name: 'LayoutDuration', value: 0.1 },
      { name: 'RecalcStyleDuration', value: 0.05 },
      { name: 'JSHeapUsedSize', value: 52_428_800 }
    ]
  }
  const end = {
    metrics: [
      { name: 'Timestamp', value: 12 },
      { name: 'TaskDuration', value: 0.9 },
      { name: 'ScriptDuration', value: 0.35 },
      { name: 'LayoutDuration', value: 0.14 },
      { name: 'RecalcStyleDuration', value: 0.07 },
      { name: 'JSHeapUsedSize', value: 62_914_560 }
    ]
  }

  assert.deepEqual(summarizeRendererPerformanceWindow(start, end), {
    averageTaskCorePercent: 20,
    durationMs: 2_000,
    heapUsedEndBytes: 62_914_560,
    heapUsedStartBytes: 52_428_800,
    layoutDurationMs: 40,
    recalcStyleDurationMs: 20,
    scriptDurationMs: 150,
    taskDurationMs: 400
  })
  assert.throws(
    () =>
      summarizeRendererPerformanceWindow(start, {
        metrics: end.metrics.filter(({ name }) => name !== 'TaskDuration')
      }),
    /TaskDuration/
  )
})

test('retains direct renderer CPU-time milliseconds without converting them to percent', () => {
  const result = deriveProcessCpuTimeDelta(
    {
      monotonicMs: 1_000,
      nowMs: 10_000,
      processCpuTimes: [
        {
          browserProcessType: 'root-browser',
          cpuTimeMs: 100,
          pid: 5001,
          role: 'client-browser'
        },
        {
          browserProcessType: 'renderer-or-worker',
          cpuTimeMs: 200,
          pid: 5004,
          role: 'client-browser'
        },
        {
          browserProcessType: 'renderer-or-worker',
          cpuTimeMs: 400,
          pid: 5008,
          role: 'client-browser'
        }
      ]
    },
    {
      monotonicMs: 1_250,
      nowMs: 10_250,
      processCpuTimes: [
        {
          browserProcessType: 'root-browser',
          cpuTimeMs: 110,
          pid: 5001,
          role: 'client-browser'
        },
        {
          browserProcessType: 'renderer-or-worker',
          cpuTimeMs: 500,
          pid: 5004,
          role: 'client-browser'
        },
        {
          browserProcessType: 'renderer-or-worker',
          cpuTimeMs: 525,
          pid: 5008,
          role: 'client-browser'
        }
      ]
    }
  )

  assert.equal(result.accepted, true)
  assert.deepEqual(result.sample.rendererProcessCpuTimeMs, [
    {
      cpuTimeMs: 300,
      pid: 5004,
      targetAttribution: 'unattributed-page-or-worker'
    },
    {
      cpuTimeMs: 125,
      pid: 5008,
      targetAttribution: 'unattributed-page-or-worker'
    }
  ])
  assert.equal(result.sample.browserProcessTypeCpuTimeMs.rendererOrWorker, 425)
  assert.equal(Object.hasOwn(result.sample, 'intervalCpuPercent'), false)
})

const heartbeat = ({
  actorAElements = 0,
  actorBElements = 0,
  actorAComplete = false,
  actorBComplete = false,
  phase = 'creating',
  proofKind = 'endpoint',
  owner = OWNER,
  extra = {}
} = {}) => ({
  activePhase: phase === 'complete' ? null : phase,
  proofKind,
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
  capturedAtMs: 1_000,
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

const arm = (state, nowMs = 0) => {
  const first = evaluateResourceSample(
    state,
    trackedCpuSample({
      nowMs,
      processes: [{ cpuTimeMs: 0, pid: TARGET_PGID, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  return evaluateResourceSample(
    first.state,
    trackedCpuSample({
      nowMs: nowMs + 250,
      processes: [{ cpuTimeMs: 0, pid: TARGET_PGID, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  ).state
}

const trackedCpuSample = ({
  cpuPercent = null,
  nowMs,
  processes,
  trackedProcessRoles = ['test-harness']
}) => {
  const roleCpuKey = (role) => {
    switch (role) {
      case 'app-server':
        return 'appServer'
      case 'client-browser':
        return 'clientBrowser'
      case 'test-harness':
        return 'testHarness'
      case 'websocket-server':
        return 'websocketServer'
      default:
        return 'unknown'
    }
  }
  const roleCpuTimeMs = {
    appServer: 0,
    clientBrowser: 0,
    testHarness: 0,
    unknown: 0,
    websocketServer: 0
  }
  const roleCpuPercent = {
    appServer: 0,
    clientBrowser: 0,
    testHarness: 0,
    unknown: 0,
    websocketServer: 0
  }
  const browserProcessTypeCpuPercent = {
    gpuProcess: 0,
    otherBrowser: 0,
    rendererOrWorker: 0,
    rootBrowser: 0,
    utility: 0
  }
  let rawCpuPercent = 0
  for (const process of processes) {
    const roleKey = roleCpuKey(process.role)
    const processCpuPercent = process.cpuPercent ?? 0
    roleCpuTimeMs[roleKey] += process.cpuTimeMs
    roleCpuPercent[roleKey] += processCpuPercent
    rawCpuPercent += processCpuPercent
    if (process.role === 'client-browser') {
      switch (process.browserProcessType) {
        case 'gpu-process':
          browserProcessTypeCpuPercent.gpuProcess += processCpuPercent
          break
        case 'renderer-or-worker':
          browserProcessTypeCpuPercent.rendererOrWorker += processCpuPercent
          break
        case 'root-browser':
          browserProcessTypeCpuPercent.rootBrowser += processCpuPercent
          break
        case 'utility':
          browserProcessTypeCpuPercent.utility += processCpuPercent
          break
        default:
          browserProcessTypeCpuPercent.otherBrowser += processCpuPercent
      }
    }
  }
  return {
    browserProcessTypeCpuPercent,
    cpuPercent: cpuPercent ?? rawCpuPercent,
    cpuTimeMs: processes.reduce(
      (total, process) => total + process.cpuTimeMs,
      0
    ),
    nowMs,
    pgid: TARGET_PGID,
    processCpuTimes: processes,
    roleCpuPercent,
    roleCpuTimeMs,
    trackedProcessRoles
  }
}

const advanceWithIdleSamples = (state, targetMs) => {
  let nextState = state
  while (nextState.previousProcessSnapshot) {
    const nextNowMs =
      nextState.previousProcessSnapshot.monotonicMs +
      DEFAULT_RESOURCE_GUARD_CONFIG.sampleIntervalMs
    if (nextNowMs > targetMs) break
    const result = evaluateResourceSample(
      nextState,
      trackedCpuSample({
        nowMs: nextNowMs,
        processes: nextState.previousProcessSnapshot.processCpuTimes.map(
          (process) => ({ ...process })
        ),
        trackedProcessRoles: nextState.sampledProcessRoles
      }),
      { targetPgid: TARGET_PGID }
    )
    assert.equal(result.decision.stop, false)
    nextState = result.state
  }
  return nextState
}

test('uses raw same-snapshot CPU and rejects converted interval percentages as stop evidence', () => {
  const baseline = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 1_000,
      processes: [
        {
          browserProcessType: 'renderer-or-worker',
          cpuPercent: 100,
          cpuTimeMs: 100,
          pid: 1,
          role: 'client-browser'
        },
        {
          cpuPercent: 5,
          cpuTimeMs: 100,
          pid: 2,
          role: 'test-harness'
        }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )
  const rawSnapshot = evaluateResourceSample(
    baseline.state,
    trackedCpuSample({
      nowMs: 1_250,
      processes: [
        {
          browserProcessType: 'renderer-or-worker',
          cpuPercent: 199.4,
          cpuTimeMs: 1_093.0075,
          pid: 1,
          role: 'client-browser'
        },
        {
          cpuPercent: 9.8,
          cpuTimeMs: 110,
          pid: 2,
          role: 'test-harness'
        }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(rawSnapshot.decision.stop, false)
  assert.equal(rawSnapshot.state.cpuSafetySamples.at(-1).rawCpuPercent, 209.2)
  assert.equal(
    rawSnapshot.state.cpuSafetySamples.at(-1).frontendRawCpuPercent,
    199.4
  )
  assert.equal(
    Object.hasOwn(
      rawSnapshot.state.cpuSafetySamples.at(-1),
      'intervalCpuPercent'
    ),
    false
  )
})

test('stops on one raw same-snapshot aggregate CPU value above 400 percent', () => {
  const result = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 1_000,
      processes: [
        {
          browserProcessType: 'renderer-or-worker',
          cpuPercent: 240,
          cpuTimeMs: 100,
          pid: 1,
          role: 'client-browser'
        },
        {
          cpuPercent: 160.01,
          cpuTimeMs: 100,
          pid: 2,
          role: 'test-harness'
        }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.state.cpuSafetySamples.at(-1).rawCpuPercent, 400.01)
  assert.equal(result.decision.stop, true)
  assert.equal(result.decision.reason, 'cpu-limit-exceeded')
})

test('enforces the raw 250% frontend peak separately from the raw 400% aggregate safety ceiling', () => {
  const evaluateRawSnapshot = (clientBrowser, testHarness) =>
    evaluateResourceSample(
      createResourceGuardState({ nowMs: 0 }),
      trackedCpuSample({
        nowMs: 1_000,
        processes: [
          {
            browserProcessType: 'renderer-or-worker',
            cpuPercent: clientBrowser,
            cpuTimeMs: 100,
            pid: 1,
            role: 'client-browser'
          },
          {
            cpuPercent: testHarness,
            cpuTimeMs: 100,
            pid: 2,
            role: 'test-harness'
          }
        ],
        trackedProcessRoles: ['test-harness', 'client-browser']
      }),
      { targetPgid: TARGET_PGID }
    )

  const allowed = evaluateRawSnapshot(250, 150)
  const frontendExceeded = evaluateRawSnapshot(250.01, 0)
  const aggregateExceeded = evaluateRawSnapshot(240, 160.01)

  assert.equal(allowed.decision.stop, false)
  assert.equal(allowed.state.cpuSafetySamples.at(-1).frontendRawCpuPercent, 250)
  assert.equal(allowed.state.cpuSafetySamples.at(-1).rawCpuPercent, 400)
  assert.equal(frontendExceeded.decision.reason, 'frontend-cpu-limit-exceeded')
  assert.equal(aggregateExceeded.decision.reason, 'cpu-limit-exceeded')

  const allowedReport = buildBoundedResourceReport(allowed.state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })
  const aggregateFailureReport = buildBoundedResourceReport(
    aggregateExceeded.state,
    {
      owner: OWNER,
      targetPgid: TARGET_PGID
    }
  )
  assert.equal(
    allowedReport.maximumFrontendCpuSafetySample.frontendRawCpuPercent,
    250
  )
  assert.equal(
    Object.hasOwn(allowedReport, 'maximumFrontendIntervalCpuSafetySample'),
    false
  )
  assert.equal(allowedReport.overallCpuLimitViolationSample, null)
  assert.equal(
    aggregateFailureReport.overallCpuLimitViolationSample.rawCpuPercent,
    400.01
  )
})

test('retains each App renderer raw percent-CPU contribution independently', () => {
  const result = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    {
      ...trackedCpuSample({
        nowMs: 1_000,
        processes: [
          {
            browserProcessType: 'renderer-or-worker',
            cpuPercent: 101.25,
            cpuTimeMs: 100,
            pid: 5004,
            role: 'client-browser'
          },
          {
            browserProcessType: 'renderer-or-worker',
            cpuPercent: 98.15,
            cpuTimeMs: 100,
            pid: 5008,
            role: 'client-browser'
          }
        ],
        trackedProcessRoles: ['client-browser']
      }),
      contributors: [
        {
          browserProcessType: 'renderer-or-worker',
          cpuPercent: 101.25,
          executable: 'chrome-headless-shell',
          parentPid: 5001,
          pgid: 5001,
          pid: 5004,
          role: 'client-browser'
        },
        {
          browserProcessType: 'renderer-or-worker',
          cpuPercent: 98.15,
          executable: 'chrome-headless-shell',
          parentPid: 5001,
          pgid: 5001,
          pid: 5008,
          role: 'client-browser'
        }
      ]
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.decision.stop, false)
  assert.equal(
    result.state.cpuSafetySamples.at(-1).frontendRawCpuPercent,
    199.4
  )
  assert.deepEqual(
    result.state.cpuSafetySamples.at(-1).rendererProcessRawCpuPercent,
    [
      { pid: 5004, rawCpuPercent: 101.25 },
      { pid: 5008, rawCpuPercent: 98.15 }
    ]
  )
})

test('rejects an interval whose sampling gap exceeds the fixed safety window', () => {
  const first = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 0,
      processes: [{ cpuTimeMs: 0, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const baseline = evaluateResourceSample(
    first.state,
    trackedCpuSample({
      nowMs: 250,
      processes: [{ cpuTimeMs: 25, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const ready = record(baseline.state, 'ready', 250)
  assert.equal(ready.accepted, true)

  const delayed = evaluateResourceSample(
    ready.state,
    trackedCpuSample({
      nowMs: 626,
      processes: [{ cpuTimeMs: 50, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(delayed.decision.stop, true)
  assert.equal(delayed.decision.reason, 'cpu-sample-gap-exceeded')
})

test('treats a short extra observation as an independent raw snapshot', () => {
  const first = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 1_000,
      processes: [{ cpuTimeMs: 100, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const shortObservation = evaluateResourceSample(
    first.state,
    trackedCpuSample({
      nowMs: 1_193,
      processes: [{ cpuTimeMs: 119, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const nextScheduledObservation = evaluateResourceSample(
    shortObservation.state,
    trackedCpuSample({
      nowMs: 1_445,
      processes: [{ cpuTimeMs: 144, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(shortObservation.state.cpuSafetySamples.at(-1).rawCpuPercent, 0)
  assert.equal(nextScheduledObservation.decision.stop, false)
  assert.equal(nextScheduledObservation.state.attributionInvalidReason, null)
})

test('serializes OS sampling and its state consumer in request order', async () => {
  let activeSamples = 0
  let maximumActiveSamples = 0
  let sequence = 0
  const events = []
  const runSerialized = createSerializedResourceSampler(async () => {
    const id = (sequence += 1)
    activeSamples += 1
    maximumActiveSamples = Math.max(maximumActiveSamples, activeSamples)
    events.push(`sample-${id}-start`)
    await Promise.resolve()
    events.push(`sample-${id}-end`)
    activeSamples -= 1
    return id
  })

  const results = await Promise.all([
    runSerialized(async (sample) => {
      events.push(`consume-${sample}`)
      return sample
    }),
    runSerialized(async (sample) => {
      events.push(`consume-${sample}`)
      return sample
    })
  ])

  assert.equal(maximumActiveSamples, 1)
  assert.deepEqual(results, [1, 2])
  assert.deepEqual(events, [
    'sample-1-start',
    'sample-1-end',
    'consume-1',
    'sample-2-start',
    'sample-2-end',
    'consume-2'
  ])
})

test('accepts a complete raw snapshot after process identity churn before readiness', () => {
  const first = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 1_000,
      processes: [{ cpuTimeMs: 100, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const churn = evaluateResourceSample(
    first.state,
    trackedCpuSample({
      nowMs: 1_250,
      processes: [
        { cpuTimeMs: 125, pid: 1, role: 'test-harness' },
        { cpuTimeMs: 10, pid: 2, role: 'client-browser' }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )
  const stable = evaluateResourceSample(
    churn.state,
    trackedCpuSample({
      nowMs: 1_500,
      processes: [
        { cpuTimeMs: 225, pid: 1, role: 'test-harness' },
        { cpuTimeMs: 110, pid: 2, role: 'client-browser' }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(churn.decision.stop, false)
  assert.equal(churn.state.acceptedRawSamples, 1)
  assert.equal(stable.state.acceptedRawSamples, 2)
})

test('rebaselines instead of stopping when process identity changes before readiness', () => {
  const provisional = arm(createResourceGuardState({ nowMs: 0 }), 1_000)
  assert.equal(provisional.acceptedRawSamples, 2)

  const churn = evaluateResourceSample(
    provisional,
    trackedCpuSample({
      nowMs: 1_500,
      processes: [
        { cpuTimeMs: 25, pid: TARGET_PGID, role: 'test-harness' },
        { cpuTimeMs: 10, pid: 2, role: 'client-browser' }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(churn.decision.stop, false)
  assert.equal(churn.state.acceptedRawSamples, 1)
  assert.equal(churn.state.attributionInvalidReason, null)
})

test('fails closed when process identity changes after guard readiness', () => {
  const first = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 1_000,
      processes: [{ cpuTimeMs: 100, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const stable = evaluateResourceSample(
    first.state,
    trackedCpuSample({
      nowMs: 1_250,
      processes: [{ cpuTimeMs: 125, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const ready = record(stable.state, 'ready', 1_250)
  assert.equal(ready.accepted, true)

  const churn = evaluateResourceSample(
    ready.state,
    trackedCpuSample({
      nowMs: 1_500,
      processes: [
        { cpuTimeMs: 150, pid: 1, role: 'test-harness' },
        { cpuTimeMs: 10, pid: 2, role: 'client-browser' }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(churn.decision.stop, true)
  assert.equal(churn.decision.reason, 'tracked-process-identity-changed')
})

test('attributes one phase from atomic cumulative CPU-time boundaries instead of heartbeat labels', () => {
  const baselineProcesses = [
    { cpuTimeMs: 50, pid: 1, role: 'app-server' },
    { cpuTimeMs: 700, pid: 2, role: 'client-browser' },
    { cpuTimeMs: 50, pid: 3, role: 'test-harness' }
  ]
  const baselineFirst = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 9_500,
      processes: baselineProcesses
    }),
    { targetPgid: TARGET_PGID }
  )
  const baselineSecond = evaluateResourceSample(
    baselineFirst.state,
    trackedCpuSample({
      nowMs: 9_750,
      processes: baselineProcesses
    }),
    { targetPgid: TARGET_PGID }
  )
  const ready = record(
    baselineSecond.state,
    'ready',
    9_750,
    heartbeat({ phase: 'earlier-heartbeat-label' })
  )
  assert.equal(ready.accepted, true)
  const start = recordResourcePhaseBoundary(
    ready.state,
    {
      kind: 'start',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        cpuTimeMs: 1_000,
        nowMs: 10_000,
        processCpuTimes: [
          { cpuTimeMs: 100, pid: 1, role: 'app-server' },
          { cpuTimeMs: 800, pid: 2, role: 'client-browser' },
          { cpuTimeMs: 100, pid: 3, role: 'test-harness' }
        ],
        roleCpuTimeMs: {
          appServer: 100,
          clientBrowser: 800,
          testHarness: 100,
          unknown: 0,
          websocketServer: 0
        }
      },
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )
  assert.equal(start.accepted, true)

  const unrelatedHeartbeat = record(
    start.state,
    'progress',
    10_100,
    heartbeat({ phase: 'later-heartbeat-label' })
  )
  assert.equal(unrelatedHeartbeat.accepted, true)

  const end = recordResourcePhaseBoundary(
    unrelatedHeartbeat.state,
    {
      kind: 'end',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        cpuTimeMs: 1_600,
        nowMs: 11_000,
        processCpuTimes: [
          { cpuTimeMs: 150, pid: 1, role: 'app-server' },
          { cpuTimeMs: 1_300, pid: 2, role: 'client-browser' },
          { cpuTimeMs: 150, pid: 3, role: 'test-harness' }
        ],
        roleCpuTimeMs: {
          appServer: 150,
          clientBrowser: 1_300,
          testHarness: 150,
          unknown: 0,
          websocketServer: 0
        }
      },
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )

  assert.equal(end.accepted, true)
  assert.deepEqual(end.state.phaseCpuTimeSamples, [
    {
      browserProcessTypeCpuTimeMs: {
        gpuProcess: 0,
        otherBrowser: 500,
        rendererOrWorker: 0,
        rootBrowser: 0,
        utility: 0
      },
      browserProcessTypeMaximumRawCpuPercent: {
        gpuProcess: 0,
        otherBrowser: 0,
        rendererOrWorker: 0,
        rootBrowser: 0,
        utility: 0
      },
      cpuTimeMs: 600,
      endedAtMs: 11_000,
      maximumFrontendRawCpuPercent: 0,
      phase: 'local-request',
      rawSampleCount: 0,
      roleCpuTimeMs: {
        appServer: 50,
        clientBrowser: 500,
        testHarness: 50,
        unknown: 0,
        websocketServer: 0
      },
      startedAtMs: 10_000,
      wallTimeMs: 1_000
    }
  ])
  assert.equal(end.state.phaseCpuTimeSamples[0].phase, 'local-request')
  assert.equal(
    Object.hasOwn(end.state.phaseCpuTimeSamples[0], 'decayedCpuPercent'),
    false
  )
})

test('applies the 400% aggregate safety stop to an explicit phase-boundary sample before attribution', () => {
  const result = recordGuardedResourcePhaseBoundary(
    createResourceGuardState({ nowMs: 0 }),
    {
      kind: 'start',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        cpuPercent: 400.01,
        cpuTimeMs: 1_000,
        nowMs: 10_000,
        pgid: TARGET_PGID,
        processCpuTimes: [
          {
            cpuTimeMs: 1_000,
            pid: TARGET_PGID,
            role: 'test-harness'
          }
        ],
        roleCpuTimeMs: {
          appServer: 0,
          clientBrowser: 0,
          testHarness: 1_000,
          unknown: 0,
          websocketServer: 0
        }
      },
      token: TOKEN
    },
    {
      expectedOwner: OWNER,
      expectedToken: TOKEN,
      targetPgid: TARGET_PGID
    }
  )

  assert.equal(result.accepted, false)
  assert.equal(result.reason, 'cpu-limit-exceeded')
  assert.equal(result.decision.stop, true)
  assert.equal(result.state.activePhaseBoundary, null)
  assert.equal(
    result.state.overallCpuLimitViolationSample.rawCpuPercent,
    400.01
  )
})

test('uses raw phase-boundary CPU without converting CPU-time deltas', () => {
  const first = evaluateResourceSample(
    createResourceGuardState({ nowMs: 0 }),
    trackedCpuSample({
      nowMs: 0,
      processes: [{ cpuTimeMs: 100, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const baseline = evaluateResourceSample(
    first.state,
    trackedCpuSample({
      nowMs: 250,
      processes: [{ cpuTimeMs: 125, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const ready = record(baseline.state, 'ready', 250)
  const start = recordGuardedResourcePhaseBoundary(
    ready.state,
    {
      kind: 'start',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        ...trackedCpuSample({
          cpuPercent: 399,
          nowMs: 500,
          processes: [{ cpuTimeMs: 150, pid: 1, role: 'test-harness' }]
        }),
        monotonicMs: 500
      },
      token: TOKEN
    },
    {
      expectedOwner: OWNER,
      expectedToken: TOKEN,
      targetPgid: TARGET_PGID
    }
  )
  assert.equal(start.accepted, true)
  assert.equal(start.decision.stop, false)

  const end = recordGuardedResourcePhaseBoundary(
    start.state,
    {
      kind: 'end',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        ...trackedCpuSample({
          cpuPercent: 10,
          nowMs: 750,
          processes: [{ cpuTimeMs: 1_151, pid: 1, role: 'test-harness' }]
        }),
        monotonicMs: 750
      },
      token: TOKEN
    },
    {
      expectedOwner: OWNER,
      expectedToken: TOKEN,
      targetPgid: TARGET_PGID
    }
  )

  assert.equal(end.accepted, true)
  assert.equal(end.reason, null)
  assert.equal(end.state.cpuSafetySamples.at(-1).rawCpuPercent, 10)
  assert.equal(end.state.phaseCpuTimeSamples.length, 1)
  assert.equal(end.state.phaseCpuTimeSamples[0].cpuTimeMs, 1_001)
  assert.equal(end.state.phaseCpuTimeSamples[0].wallTimeMs, 250)
  assert.equal(
    Object.hasOwn(end.state.phaseCpuTimeSamples[0], 'averageCpuPercent'),
    false
  )
})

test('treats sub-cadence phase boundaries as independent raw snapshots', () => {
  const armed = arm(createResourceGuardState({ nowMs: 0 }))
  const ready = record(armed, 'ready', 250)
  assert.equal(ready.accepted, true)

  const start = recordGuardedResourcePhaseBoundary(
    ready.state,
    {
      kind: 'start',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        ...trackedCpuSample({
          cpuPercent: 7.6,
          nowMs: 277,
          processes: [
            {
              cpuTimeMs: 60,
              pid: TARGET_PGID,
              role: 'test-harness'
            }
          ]
        }),
        monotonicMs: 277
      },
      token: TOKEN
    },
    {
      expectedOwner: OWNER,
      expectedToken: TOKEN,
      targetPgid: TARGET_PGID
    }
  )

  assert.equal(start.accepted, true)
  assert.equal(start.decision.stop, false)
  assert.equal(start.state.activePhaseBoundary.phase, 'local-request')
  assert.equal(start.state.previousProcessSnapshot.monotonicMs, 277)
  assert.equal(start.state.cpuSafetySamples.at(-1).rawCpuPercent, 7.6)

  const periodic = evaluateResourceSample(
    start.state,
    trackedCpuSample({
      cpuPercent: 10,
      nowMs: 500,
      processes: [
        {
          cpuTimeMs: 100,
          pid: TARGET_PGID,
          role: 'test-harness'
        }
      ]
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(periodic.decision.stop, false)
  assert.equal(periodic.state.cpuSafetySamples.at(-1).rawCpuPercent, 10)
  assert.equal(
    periodic.state.activePhaseBoundary.maximumFrontendRawCpuPercent,
    0
  )

  const overLimit = evaluateResourceSample(
    start.state,
    trackedCpuSample({
      cpuPercent: 400.01,
      nowMs: 500,
      processes: [
        {
          cpuTimeMs: 1_001,
          pid: TARGET_PGID,
          role: 'test-harness'
        }
      ]
    }),
    { targetPgid: TARGET_PGID }
  )
  assert.equal(overLimit.decision.stop, true)
  assert.equal(overLimit.decision.reason, 'cpu-limit-exceeded')
  assert.equal(overLimit.state.cpuSafetySamples.at(-1).rawCpuPercent, 400.01)
})

test('rejects phase attribution when a process present at start exits before the end sample', () => {
  const start = recordResourcePhaseBoundary(
    createResourceGuardState({ nowMs: 0 }),
    {
      kind: 'start',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        cpuTimeMs: 300,
        nowMs: 1_000,
        processCpuTimes: [
          { cpuTimeMs: 100, pid: 1, role: 'test-harness' },
          { cpuTimeMs: 200, pid: 2, role: 'client-browser' }
        ],
        roleCpuTimeMs: {
          appServer: 0,
          clientBrowser: 200,
          testHarness: 100,
          unknown: 0,
          websocketServer: 0
        }
      },
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )
  const end = recordResourcePhaseBoundary(
    start.state,
    {
      kind: 'end',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        cpuTimeMs: 200,
        nowMs: 2_000,
        processCpuTimes: [{ cpuTimeMs: 200, pid: 1, role: 'test-harness' }],
        roleCpuTimeMs: {
          appServer: 0,
          clientBrowser: 0,
          testHarness: 200,
          unknown: 0,
          websocketServer: 0
        }
      },
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )

  assert.equal(end.accepted, false)
  assert.equal(end.reason, 'phase-process-exited')
  assert.deepEqual(end.state.phaseCpuTimeSamples, [])
})

test('rejects phase attribution when a new process appears at the end boundary', () => {
  const start = recordResourcePhaseBoundary(
    createResourceGuardState({ nowMs: 0 }),
    {
      kind: 'start',
      owner: OWNER,
      phase: 'local-request',
      sample: trackedCpuSample({
        nowMs: 1_000,
        processes: [{ cpuTimeMs: 100, pid: 1, role: 'test-harness' }]
      }),
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )
  const end = recordResourcePhaseBoundary(
    start.state,
    {
      kind: 'end',
      owner: OWNER,
      phase: 'local-request',
      sample: trackedCpuSample({
        nowMs: 2_000,
        processes: [
          { cpuTimeMs: 200, pid: 1, role: 'test-harness' },
          { cpuTimeMs: 50, pid: 2, role: 'client-browser' }
        ]
      }),
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )

  assert.equal(end.accepted, false)
  assert.equal(end.reason, 'phase-process-created')
  assert.deepEqual(end.state.phaseCpuTimeSamples, [])
})

test('rejects phase attribution after any process identity churn observed by the safety sampler', () => {
  const start = recordResourcePhaseBoundary(
    createResourceGuardState({ nowMs: 0 }),
    {
      kind: 'start',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        cpuTimeMs: 100,
        nowMs: 1_000,
        processCpuTimes: [{ cpuTimeMs: 100, pid: 1, role: 'test-harness' }],
        roleCpuTimeMs: {
          appServer: 0,
          clientBrowser: 0,
          testHarness: 100,
          unknown: 0,
          websocketServer: 0
        }
      },
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )
  const withTransientProcess = evaluateResourceSample(
    start.state,
    {
      cpuPercent: 50,
      nowMs: 1_250,
      pgid: TARGET_PGID,
      processCpuTimes: [
        { cpuTimeMs: 125, pid: 1, role: 'test-harness' },
        { cpuTimeMs: 10, pid: 2, role: 'client-browser' }
      ]
    },
    { targetPgid: TARGET_PGID }
  )
  const end = recordResourcePhaseBoundary(
    withTransientProcess.state,
    {
      kind: 'end',
      owner: OWNER,
      phase: 'local-request',
      sample: {
        cpuTimeMs: 150,
        nowMs: 2_000,
        processCpuTimes: [{ cpuTimeMs: 150, pid: 1, role: 'test-harness' }],
        roleCpuTimeMs: {
          appServer: 0,
          clientBrowser: 0,
          testHarness: 150,
          unknown: 0,
          websocketServer: 0
        }
      },
      token: TOKEN
    },
    { expectedOwner: OWNER, expectedToken: TOKEN }
  )

  assert.equal(end.accepted, false)
  assert.equal(end.reason, 'phase-process-churn')
  assert.deepEqual(end.state.phaseCpuTimeSamples, [])
})

test('stops immediately when the tracked process group exceeds 400% aggregate CPU', () => {
  const state = createResourceGuardState({ nowMs: 0 })
  const result = evaluateResourceSample(
    state,
    trackedCpuSample({
      cpuPercent: 400.01,
      nowMs: 1_000,
      processes: [{ cpuTimeMs: 100, pid: 1, role: 'test-harness' }]
    }),
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
  assert.equal(DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent, 400)
  assert.equal(DEFAULT_RESOURCE_GUARD_CONFIG.maximumFrontendCpuPercent, 250)
  assert.equal(DEFAULT_RESOURCE_GUARD_CONFIG.sampleIntervalMs, 250)
  assert.equal(result.state.config.maximumCpuPercent, 400)
  assert.equal(result.state.config.maximumFrontendCpuPercent, 250)
  assert.equal(result.state.config.sampleIntervalMs, 250)
})

test('stops immediately when bootstrap frontend CPU exceeds 250%', () => {
  const state = createResourceGuardState({ nowMs: 0 })
  const result = evaluateResourceSample(
    state,
    {
      ...trackedCpuSample({
        cpuPercent: 250.01,
        nowMs: 1_000,
        processes: [{ cpuTimeMs: 100, pid: 1, role: 'client-browser' }],
        trackedProcessRoles: ['client-browser']
      }),
      roleCpuPercent: {
        appServer: 0,
        clientBrowser: 250.01,
        testHarness: 0,
        unknown: 0,
        websocketServer: 0
      }
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.accepted, true)
  assert.equal(result.decision.stop, true)
  assert.equal(result.decision.reason, 'frontend-cpu-limit-exceeded')
  assert.equal(
    result.state.maximumFrontendBootstrapCpuSafetySample.frontendRawCpuPercent,
    250.01
  )
  assert.equal(result.state.overallCpuLimitViolationSample, null)
})

test('allows the exact endpoint proof to use the 400% high-detail frontend ceiling', () => {
  const state = createResourceGuardState({
    nowMs: 0,
    config: {
      maximumFrontendCpuPercent: 400,
      requiredProofKind: 'endpoint'
    }
  })
  const result = evaluateResourceSample(
    state,
    {
      ...trackedCpuSample({
        cpuPercent: 300,
        nowMs: 1_000,
        processes: [{ cpuTimeMs: 100, pid: 1, role: 'client-browser' }],
        trackedProcessRoles: ['client-browser']
      }),
      roleCpuPercent: {
        appServer: 0,
        clientBrowser: 300,
        testHarness: 0,
        unknown: 0,
        websocketServer: 0
      }
    },
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.accepted, true)
  assert.equal(result.decision.stop, false)
  assert.equal(result.state.config.maximumFrontendCpuPercent, 400)
})

test('allows every tracked process-group sample at or below 400% aggregate CPU', () => {
  let state = createResourceGuardState({ nowMs: 0 })

  for (let index = 0; index < 8; index += 1) {
    const result = evaluateResourceSample(
      state,
      trackedCpuSample({
        cpuPercent: 400,
        nowMs: (index + 1) * 250,
        processes: [
          {
            cpuTimeMs: (index + 1) * 1_000,
            pid: 1,
            role: 'test-harness'
          }
        ]
      }),
      { targetPgid: TARGET_PGID }
    )
    assert.equal(result.decision.stop, false)
    state = result.state
  }
  assert.equal(state.cpuSafetySamples.at(-1).rawCpuPercent, 400)
})

test('keeps the 200% hard ceiling for an explicit root-cause diagnostic state', () => {
  const state = createResourceGuardState({
    nowMs: 0,
    config: {
      guardMode: 'diagnostic',
      maximumCpuPercent: 200
    }
  })
  const baseline = evaluateResourceSample(
    state,
    trackedCpuSample({
      cpuPercent: 175,
      nowMs: 250,
      processes: [{ cpuTimeMs: 0, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const belowDiagnosticLimit = evaluateResourceSample(
    baseline.state,
    trackedCpuSample({
      cpuPercent: 175,
      nowMs: 500,
      processes: [{ cpuTimeMs: 437.5, pid: 1, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )
  const aboveDiagnosticLimit = evaluateResourceSample(
    belowDiagnosticLimit.state,
    trackedCpuSample({
      cpuPercent: 200.01,
      nowMs: 750,
      processes: [{ cpuTimeMs: 937.525, pid: 1, role: 'test-harness' }]
    }),
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
  const beforeBusy = advanceWithIdleSamples(ready.state, 9_751)

  const result = evaluateResourceSample(
    beforeBusy,
    trackedCpuSample({
      cpuPercent: 81,
      nowMs: 10_001,
      processes: [{ cpuTimeMs: 202.5, pid: TARGET_PGID, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.decision.stop, true)
  assert.equal(result.decision.reason, 'heartbeat-stale')
})

test('stops on stalled A/B progress, but disables progress stall after both actors complete', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const armed = arm(initial)
  const ready = record(armed, 'ready', 0)
  const beforeStall = advanceWithIdleSamples(ready.state, 19_751)
  const stalled = evaluateResourceSample(
    beforeStall,
    trackedCpuSample({
      cpuPercent: 81,
      nowMs: 20_001,
      processes: [{ cpuTimeMs: 202.5, pid: TARGET_PGID, role: 'test-harness' }]
    }),
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
          proofKind: 'endpoint',
          status: 'complete'
        }
      }
    })
  )
  const beforeCompleteSample = advanceWithIdleSamples(complete.state, 39_751)
  const afterComplete = evaluateResourceSample(
    beforeCompleteSample,
    trackedCpuSample({
      cpuPercent: 0,
      nowMs: 40_001,
      processes: [{ cpuTimeMs: 202.5, pid: TARGET_PGID, role: 'test-harness' }]
    }),
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

test('does not invalidate an accepted proof when Chrome process identity changes during teardown', () => {
  const ready = record(arm(createResourceGuardState({ nowMs: 0 })), 'ready', 0)
  const complete = record(
    ready.state,
    'complete',
    1_000,
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
          proofKind: 'endpoint',
          status: 'complete'
        }
      }
    })
  )
  const teardownSample = evaluateResourceSample(
    complete.state,
    trackedCpuSample({
      cpuPercent: 0,
      nowMs: 1_250,
      processes: [
        { cpuTimeMs: 0, pid: TARGET_PGID, role: 'test-harness' },
        { cpuTimeMs: 0, pid: 5001, role: 'client-browser' }
      ],
      trackedProcessRoles: ['test-harness', 'client-browser']
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(teardownSample.decision.stop, false)
  assert.equal(teardownSample.state.stopDecision, null)
  assert.equal(teardownSample.state.attributionInvalidReason, null)
})

test('does not mistake stale activity for a host emergency at low CPU', () => {
  const initial = createResourceGuardState({ nowMs: 0 })
  const ready = record(arm(initial), 'ready', 0)
  const beforeLowCpu = advanceWithIdleSamples(ready.state, 59_750)
  const result = evaluateResourceSample(
    beforeLowCpu,
    trackedCpuSample({
      cpuPercent: 0,
      nowMs: 60_000,
      processes: [{ cpuTimeMs: 200, pid: TARGET_PGID, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  )

  assert.equal(result.decision.stop, false)
})

test('accepts bounded bootstrap progress before freezing the ready request identity', () => {
  const initial = createResourceGuardState({ nowMs: 0 })

  const prematureProgress = record(initial, 'progress', 1)
  assert.equal(prematureProgress.accepted, true)
  assert.equal(prematureProgress.state.ready, false)
  assert.equal(prematureProgress.state.lastHeartbeat.phase, 'creating')

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

test('new pre-ready process registration clears a provisional CPU baseline', () => {
  let state = arm(createResourceGuardState({ nowMs: 0 }), 1_000)
  assert.equal(state.acceptedRawSamples, 2)
  assert.notEqual(state.previousProcessSnapshot, null)

  const registration = recordTrackedProcessGroupRegistration(
    state,
    {
      owner: OWNER,
      pgid: 5001,
      pid: 5001,
      role: 'client-browser',
      token: TOKEN
    },
    {
      descendantVerified: true,
      expectedOwner: OWNER,
      expectedToken: TOKEN,
      rootPgid: TARGET_PGID
    }
  )

  assert.equal(registration.accepted, true)
  assert.equal(registration.state.acceptedRawSamples, 0)
  assert.equal(registration.state.previousProcessSnapshot, null)
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

test('accepts a local attribution report without inventing a completed Actor B', () => {
  const initial = createResourceGuardState({
    config: { requiredProofKind: 'local-attribution' },
    nowMs: 0
  })
  const localHeartbeat = heartbeat({
    actorAComplete: true,
    actorAElements: 17,
    actorBComplete: false,
    actorBElements: 0,
    phase: 'complete',
    proofKind: 'local-attribution',
    extra: {
      actorA: {
        canonicalElements: 17,
        complete: true,
        elements: 17,
        renderProjectionElements: 17,
        total: 17
      },
      actorB: {
        canonicalElements: 0,
        complete: false,
        elements: 0,
        renderProjectionElements: 0,
        total: 0
      },
      report: {
        actorA: {
          completeMs: 20,
          diagnostics: { topPhases: [] },
          firstVisibleMs: 10,
          summary: { renderedCount: 17, requestedItems: 16, totalCount: 17 }
        },
        actorB: null,
        durationMs: 25,
        owner: OWNER,
        proofKind: 'local-attribution',
        status: 'complete'
      }
    }
  })
  const ready = record(
    arm(initial),
    'ready',
    0,
    heartbeat({
      proofKind: 'local-attribution',
      extra: {
        actorB: {
          canonicalElements: 0,
          complete: false,
          elements: 0,
          renderProjectionElements: 0,
          total: 0
        }
      }
    })
  )
  const completed = record(ready.state, 'complete', 25, localHeartbeat)

  assert.equal(completed.accepted, true)
  assert.equal(completed.state.finished, true)
  assert.equal(completed.state.endpointReport.proofKind, 'local-attribution')
  assert.equal(completed.state.endpointReport.actorB, null)
  assert.equal(completed.state.lastHeartbeat.actorB.complete, false)
})

test('keeps a two-Actor small attribution distinct from an endpoint acceptance proof', () => {
  const initial = createResourceGuardState({
    config: { requiredProofKind: 'collaboration-attribution' },
    nowMs: 0
  })
  const ready = record(
    arm(initial),
    'ready',
    0,
    heartbeat({ proofKind: 'collaboration-attribution' })
  )
  const completed = record(
    ready.state,
    'complete',
    25,
    heartbeat({
      actorAComplete: true,
      actorAElements: 17,
      actorBComplete: true,
      actorBElements: 17,
      phase: 'complete',
      proofKind: 'collaboration-attribution',
      extra: {
        actorA: {
          canonicalElements: 17,
          complete: true,
          elements: 17,
          renderProjectionElements: 17,
          total: 17
        },
        actorB: {
          canonicalElements: 17,
          complete: true,
          elements: 17,
          renderProjectionElements: 17,
          total: 17
        },
        report: {
          actorA: {
            completeMs: 20,
            diagnostics: { topPhases: [] },
            firstVisibleMs: 10,
            summary: { renderedCount: 17, requestedItems: 16, totalCount: 17 }
          },
          actorB: {
            completeMs: 22,
            diagnostics: { topPhases: [] },
            firstVisibleMs: 12,
            summary: { renderedCount: 17, requestedItems: 16, totalCount: 17 }
          },
          durationMs: 25,
          owner: OWNER,
          proofKind: 'collaboration-attribution',
          status: 'complete'
        }
      }
    })
  )

  assert.equal(completed.accepted, true)
  assert.equal(
    completed.state.endpointReport.proofKind,
    'collaboration-attribution'
  )
  assert.notEqual(completed.state.endpointReport.proofKind, 'endpoint')
})

test('preserves the bounded failed-heartbeat reason in the final report', () => {
  const initial = createResourceGuardState({
    config: { requiredProofKind: 'local-attribution' },
    nowMs: 0
  })
  const ready = record(
    arm(initial),
    'ready',
    0,
    heartbeat({
      proofKind: 'local-attribution',
      extra: {
        actorB: {
          canonicalElements: 0,
          complete: false,
          elements: 0,
          renderProjectionElements: 0,
          total: 0
        }
      }
    })
  )
  const failed = record(
    ready.state,
    'failed',
    25,
    heartbeat({
      phase: 'failed',
      proofKind: 'local-attribution',
      extra: {
        actorB: {
          canonicalElements: 0,
          complete: false,
          elements: 0,
          renderProjectionElements: 0,
          total: 0
        },
        error: {
          message: `Expected phase evidence ${'x'.repeat(600)}`,
          name: 'AssertionError',
          ownerEvidence: {
            actorA: {
              diagnostics: {
                phaseTimeline: [
                  {
                    atMs: 1,
                    durationMs: 2,
                    name: 'must-not-leak-timeline'
                  }
                ],
                topPhases: Array.from({ length: 30 }, (_, index) => ({
                  durationMs: index + 1,
                  name: `actor-a-phase-${index}`
                }))
              },
              secret: 'must-not-leak',
              summary: {}
            },
            actorB: {
              diagnostics: {
                remoteProcessedCount: 72,
                topPhases: [
                  {
                    durationMs: 123.456,
                    name: 'collaboration:remote-publication-apply'
                  }
                ]
              },
              summary: {}
            }
          },
          secret: 'must-not-leak'
        }
      }
    })
  )
  const report = buildBoundedResourceReport(failed.state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })

  assert.equal(failed.accepted, true)
  assert.deepEqual(report.failure, {
    message: `Expected phase evidence ${'x'.repeat(476)}`,
    name: 'AssertionError',
    ownerEvidence: {
      actorA: {
        diagnostics: {
          renderProjectionAnomalies: {},
          topPhases: Array.from({ length: 24 }, (_, index) => ({
            durationMs: index + 1,
            name: `actor-a-phase-${index}`
          })),
          visibleWorkerTargets: []
        }
      },
      actorB: {
        diagnostics: {
          remoteProcessedCount: 72,
          renderProjectionAnomalies: {},
          topPhases: [
            {
              durationMs: 123.456,
              name: 'collaboration:remote-publication-apply'
            }
          ],
          visibleWorkerTargets: []
        }
      }
    }
  })
})

test('pins the proof kind for the complete guarded invocation', () => {
  const endpointState = createResourceGuardState({
    config: { requiredProofKind: 'endpoint' },
    nowMs: 0
  })
  const localReady = record(
    arm(endpointState),
    'ready',
    0,
    heartbeat({
      proofKind: 'local-attribution',
      extra: {
        actorB: {
          canonicalElements: 0,
          complete: false,
          elements: 0,
          renderProjectionElements: 0,
          total: 0
        }
      }
    })
  )

  assert.equal(localReady.accepted, false)
  assert.equal(localReady.reason, 'unexpected-proof-kind')
  assert.equal(localReady.state.ready, false)
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
        cpuPercent: 201,
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
        globalThis.queueMicrotask(() => child.emit('close', 0, null))
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
  assert.deepEqual(result.state.cpuSafetySamples, [])
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
        phase: `slice-${index}`,
        extra:
          index === 6
            ? {
                ownerEvidence: {
                  actorA: {
                    diagnostics: {
                      topPhases: [
                        {
                          durationMs: 45.5,
                          name: 'actor-a-complete'
                        }
                      ]
                    },
                    secret: 'must-not-leak',
                    summary: { secret: 'must-not-leak' }
                  },
                  actorB: {
                    diagnostics: {
                      remoteProcessedCount: 74,
                      topPhases: [
                        {
                          durationMs: 987.5,
                          name: 'actor-b-active-owner'
                        }
                      ]
                    },
                    summary: {}
                  }
                }
              }
            : {}
      })
    ).state
    state = evaluateResourceSample(
      state,
      trackedCpuSample({
        cpuPercent: index === 1 ? 149 : 50 + index,
        nowMs: index * 1_000,
        processes: [
          {
            cpuTimeMs: index * 100,
            pid: TARGET_PGID,
            role: 'test-harness'
          }
        ]
      }),
      { targetPgid: TARGET_PGID, config }
    ).state
  }

  const report = buildBoundedResourceReport(state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })

  assert.equal(report.heartbeats.length, 3)
  assert.equal(report.cpuSafetySamples.length, 3)
  assert.equal(report.phase, 'slice-6')
  assert.equal(report.actorA.elements, 6)
  assert.equal(report.actorB.elements, 5)
  assert.equal(report.maximumFrontendCpuSafetySample.frontendRawCpuPercent, 0)
  assert.equal(
    report.maximumFrontendCpuSafetySample.heartbeatCapturedAtMs,
    null
  )
  assert.equal(report.maximumFrontendCpuSafetySample.sampledAtMs, 0)
  assert.equal(
    Object.hasOwn(report, 'maximumFrontendIntervalCpuSafetySample'),
    false
  )
  assert.equal(
    report.cpuSafetySamples.some(({ sampledAtMs }) => sampledAtMs === 1_000),
    false
  )
  assert.deepEqual(report.ownerTiming, {
    actorADurationMs: 12,
    actorAPhase: 'factory:notify-shared-publication',
    actorBDurationMs: 8,
    actorBPhase: 'remote-apply'
  })
  assert.deepEqual(report.ownerEvidence, {
    actorA: {
      diagnostics: {
        renderProjectionAnomalies: {},
        topPhases: [
          {
            durationMs: 45.5,
            name: 'actor-a-complete'
          }
        ],
        visibleWorkerTargets: []
      }
    },
    actorB: {
      diagnostics: {
        remoteProcessedCount: 74,
        renderProjectionAnomalies: {},
        topPhases: [
          {
            durationMs: 987.5,
            name: 'actor-b-active-owner'
          }
        ],
        visibleWorkerTargets: []
      }
    }
  })
  assert.equal(JSON.stringify(report).includes(TOKEN), false)
  assert.equal(JSON.stringify(report).includes('must-not-leak'), false)
})

test('never attributes raw CPU safety samples to diagnostic phases', () => {
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
      trackedCpuSample({
        cpuPercent: index,
        nowMs: index * 1_000,
        processes: [
          {
            cpuTimeMs: index * 10,
            pid: TARGET_PGID,
            role: 'test-harness'
          }
        ]
      }),
      { targetPgid: TARGET_PGID }
    ).state
  }

  state = evaluateResourceSample(
    state,
    trackedCpuSample({
      cpuPercent: 1,
      nowMs: 31_000,
      processes: [{ cpuTimeMs: 310, pid: TARGET_PGID, role: 'test-harness' }]
    }),
    { targetPgid: TARGET_PGID }
  ).state

  const report = buildBoundedResourceReport(state, {
    owner: OWNER,
    targetPgid: TARGET_PGID
  })

  assert.equal(Object.hasOwn(report, 'phaseCpuMaximums'), false)
  assert.equal(Object.hasOwn(report, 'maximumCpuSafetySample'), false)
  assert.equal(report.maximumFrontendCpuSafetySample.frontendRawCpuPercent, 0)
  assert.equal(report.phaseCpuTimeSamples.length, 0)
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
          `${TARGET_PGID} 1 ${TARGET_PGID} 12.0 0:00.10 node /repo/.yarn/releases/yarn-4.9.2.cjs playwright --guard-token=TOP-SECRET`,
          `5001 ${TARGET_PGID} 5001 10.0 0:00.10 /Applications/chrome-headless-shell`,
          `5004 5001 5001 40.0 0:00.60 /Applications/chrome-headless-shell --type=renderer`,
          `5005 5001 5001 20.0 0:00.25 /Applications/chrome-headless-shell --type=gpu-process`,
          `5006 5001 5001 15.0 0:00.20 /Applications/chrome-headless-shell --type=utility`,
          `5007 5001 5001 6.0 0:00.10 /Applications/chrome-headless-shell --type=zygote`,
          `5002 ${TARGET_PGID} 5002 4.0 0:00.05 node node_modules/vite/bin/vite.js preview`,
          `5003 ${TARGET_PGID} 5003 18.0 0:00.20 node dist/collaboration-server/collaboration-server.js`,
          `6000 ${TARGET_PGID} 6000 999.0 0:30.00 node untracked.js`
        ].join('\n')
      )
    },
    monotonicMs: 900,
    nowMs: 1_000,
    platform: 'darwin',
    processGroups
  })

  assert.equal(snapshotCount, 1)
  assert.deepEqual(receivedArguments, [
    '-g',
    `${TARGET_PGID},5001,5002,5003`,
    '-o',
    'pid=,ppid=,pgid=,%cpu=,time=,command='
  ])
  assert.equal(receivedOptions.timeout, 200)
  assert.equal(receivedOptions.killSignal, 'SIGKILL')
  assert.equal(receivedOptions.maxBuffer, 256 * 1024)
  assert.deepEqual(result, {
    browserProcessTypeCpuPercent: {
      gpuProcess: 20,
      otherBrowser: 6,
      rendererOrWorker: 40,
      rootBrowser: 10,
      utility: 15
    },
    browserProcessTypeCpuTimeMs: {
      gpuProcess: 250,
      otherBrowser: 100,
      rendererOrWorker: 600,
      rootBrowser: 100,
      utility: 200
    },
    contributors: [
      {
        browserProcessType: 'renderer-or-worker',
        cpuPercent: 40,
        executable: 'chrome-headless-shell',
        parentPid: 5001,
        pgid: 5001,
        pid: 5004,
        role: 'client-browser'
      },
      {
        browserProcessType: 'gpu-process',
        cpuPercent: 20,
        executable: 'chrome-headless-shell',
        parentPid: 5001,
        pgid: 5001,
        pid: 5005,
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
        browserProcessType: 'utility',
        cpuPercent: 15,
        executable: 'chrome-headless-shell',
        parentPid: 5001,
        pgid: 5001,
        pid: 5006,
        role: 'client-browser'
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
        browserProcessType: 'root-browser',
        cpuPercent: 10,
        executable: 'chrome-headless-shell',
        parentPid: TARGET_PGID,
        pgid: 5001,
        pid: 5001,
        role: 'client-browser'
      },
      {
        browserProcessType: 'other-browser',
        cpuPercent: 6,
        executable: 'chrome-headless-shell',
        parentPid: 5001,
        pgid: 5001,
        pid: 5007,
        role: 'client-browser'
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
    cpuTimeMs: 1_600,
    cpuPercent: 125,
    missingProcessRoles: [],
    monotonicMs: 900,
    nowMs: 1_000,
    pgid: TARGET_PGID,
    processCpuTimes: [
      { cpuTimeMs: 100, pid: TARGET_PGID, role: 'test-harness' },
      {
        browserProcessType: 'root-browser',
        cpuTimeMs: 100,
        pid: 5001,
        role: 'client-browser'
      },
      { cpuTimeMs: 50, pid: 5002, role: 'app-server' },
      { cpuTimeMs: 200, pid: 5003, role: 'websocket-server' },
      {
        browserProcessType: 'renderer-or-worker',
        cpuTimeMs: 600,
        pid: 5004,
        role: 'client-browser'
      },
      {
        browserProcessType: 'gpu-process',
        cpuTimeMs: 250,
        pid: 5005,
        role: 'client-browser'
      },
      {
        browserProcessType: 'utility',
        cpuTimeMs: 200,
        pid: 5006,
        role: 'client-browser'
      },
      {
        browserProcessType: 'other-browser',
        cpuTimeMs: 100,
        pid: 5007,
        role: 'client-browser'
      }
    ],
    roleCpuPercent: {
      appServer: 4,
      clientBrowser: 91,
      testHarness: 12,
      unknown: 0,
      websocketServer: 18
    },
    roleCpuTimeMs: {
      appServer: 50,
      clientBrowser: 1_250,
      testHarness: 100,
      unknown: 0,
      websocketServer: 200
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
      ...trackedCpuSample({
        cpuPercent: 401,
        nowMs: 1_000,
        processes: [{ cpuTimeMs: 100, pid: TARGET_PGID, role: 'test-harness' }]
      }),
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
  assert.deepEqual(result.state.cpuSafetySamples[0].contributors, [
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
      pid: TARGET_PGID + 5,
      parentPid: TARGET_PGID,
      cpuPercent: 5,
      executable: '/usr/local/bin/node'
    }
  ])
  assert.equal(
    JSON.stringify(result.state.cpuSafetySamples).includes(TOKEN),
    false
  )
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

test('builds only the guarded Playwright runtime after separate production setup', () => {
  const phases = buildEndpointPerformancePhases({
    owner: OWNER,
    baseEnv: {
      ASYRA_DESIGN_ENDPOINT_CONNECTIVITY_ONLY: '1',
      PATH: '/test/bin'
    }
  })

  assert.deepEqual(
    phases.map((phase) => phase.name),
    ['playwright']
  )
  assert.deepEqual(phases[0].guardConfig, {
    guardMode: 'proof',
    maximumCpuPercent: 400,
    maximumFrontendCpuPercent: 400,
    requiredProofKind: 'endpoint',
    requiredProcessRoles: [
      'test-harness',
      'client-browser',
      'app-server',
      'websocket-server'
    ]
  })
  assert.deepEqual(phases[0].argv, [
    '--owner',
    OWNER,
    '--',
    'yarn',
    'playwright',
    'test',
    '--config',
    'playwright.endpoint-performance.config.ts',
    '--workers=1',
    '--grep',
    'creation-only high-detail endpoint proof'
  ])
  assert.equal(phases[0].baseEnv.GOMAXPROCS, undefined)
  assert.equal(phases[0].baseEnv.NODE_OPTIONS, undefined)
  assert.equal(phases[0].baseEnv.UV_THREADPOOL_SIZE, undefined)
  assert.equal(phases[0].baseEnv.ASYRA_DESIGN_APP_URL, 'http://127.0.0.1:3021')
  assert.equal(phases[0].baseEnv.ASYRA_DESIGN_COLLABORATION_WS_PORT, '4121')
  assert.equal(phases[0].baseEnv.ASYRA_DESIGN_ENDPOINT_CONNECTIVITY_ONLY, '0')
})

test('builds each single-Actor attribution with the always-on WebSocket service', () => {
  for (const attributionCase of ['16', '16-reduced-motion', '1280']) {
    const phases = buildEndpointPerformancePhases({
      owner: OWNER,
      baseEnv: {
        ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE: attributionCase,
        PATH: '/test/bin'
      }
    })

    assert.deepEqual(
      phases.map((phase) => phase.name),
      ['playwright']
    )
    assert.deepEqual(phases[0].ports, [3021, 4121])
    assert.deepEqual(phases[0].guardConfig.requiredProcessRoles, [
      'test-harness',
      'client-browser',
      'app-server',
      'websocket-server'
    ])
    assert.equal(phases[0].guardConfig.requiredProofKind, 'local-attribution')
    assert.equal(phases[0].guardConfig.maximumFrontendCpuPercent, 250)
    assert.equal(
      phases[0].baseEnv.ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE,
      attributionCase
    )
    assert.equal(phases[0].baseEnv.ASYRA_DESIGN_ENDPOINT_LOCAL_ONLY, undefined)
    assert.deepEqual(phases[0].argv.slice(-2), [
      '--grep',
      'single-Actor local attribution'
    ])
    assert.equal(
      phases.some(({ name }) => name === 'collaboration-build'),
      false
    )
  }
})

test('builds the two-Actor 16-item operation and idle diagnostic as one endpoint proof', () => {
  const phases = buildEndpointPerformancePhases({
    owner: OWNER,
    baseEnv: {
      ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE: '16-two-actor-activity',
      PATH: '/test/bin'
    }
  })

  assert.equal(
    phases[0].guardConfig.requiredProofKind,
    'collaboration-attribution'
  )
  assert.equal(phases[0].guardConfig.maximumFrontendCpuPercent, 250)
  assert.deepEqual(phases[0].argv.slice(-2), [
    '--grep',
    'two-Actor operation and idle attribution'
  ])
  assert.equal(
    phases[0].baseEnv.ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE,
    '16-two-actor-activity'
  )
})

test('builds the two-Actor 1280-item attribution under the small-case guard', () => {
  const phases = buildEndpointPerformancePhases({
    owner: OWNER,
    baseEnv: {
      ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE: '1280-two-actor-attribution',
      PATH: '/test/bin'
    }
  })

  assert.equal(
    phases[0].guardConfig.requiredProofKind,
    'collaboration-attribution'
  )
  assert.equal(phases[0].guardConfig.maximumFrontendCpuPercent, 250)
  assert.deepEqual(phases[0].argv.slice(-2), [
    '--grep',
    'two-Actor operation and idle attribution'
  ])
  assert.equal(
    phases[0].baseEnv.ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE,
    '1280-two-actor-attribution'
  )
})

test('builds the two-Actor 320-item fallback under the small-case guard', () => {
  const phases = buildEndpointPerformancePhases({
    owner: OWNER,
    baseEnv: {
      ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE: '320-two-actor-attribution',
      PATH: '/test/bin'
    }
  })

  assert.equal(
    phases[0].guardConfig.requiredProofKind,
    'collaboration-attribution'
  )
  assert.equal(phases[0].guardConfig.maximumFrontendCpuPercent, 250)
  assert.deepEqual(phases[0].argv.slice(-2), [
    '--grep',
    'two-Actor operation and idle attribution'
  ])
  assert.equal(
    phases[0].baseEnv.ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE,
    '320-two-actor-attribution'
  )
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
      await new Promise((resolveRead) => globalThis.queueMicrotask(resolveRead))
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

  const beforeAllRoles = record(state, 'ready', 1)
  assert.equal(beforeAllRoles.accepted, false)
  assert.equal(beforeAllRoles.reason, 'guard-not-armed')

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

  const allProcesses = [
    { cpuTimeMs: 100, pid: TARGET_PGID, role: 'test-harness' },
    { cpuTimeMs: 100, pid: 5001, role: 'client-browser' },
    { cpuTimeMs: 100, pid: 5002, role: 'app-server' },
    { cpuTimeMs: 100, pid: 5003, role: 'websocket-server' }
  ]
  state = evaluateResourceSample(
    state,
    trackedCpuSample({
      nowMs: 3,
      processes: allProcesses,
      trackedProcessRoles: requiredProcessRoles
    }),
    { targetPgid: TARGET_PGID }
  ).state
  const ready = record(state, 'ready', 3)
  assert.equal(ready.accepted, true)

  const stopping = evaluateResourceSample(
    ready.state,
    trackedCpuSample({
      cpuPercent: 0,
      nowMs: 503,
      processes: [
        { cpuTimeMs: 1_102.5, pid: TARGET_PGID, role: 'test-harness' },
        { cpuTimeMs: 100, pid: 5001, role: 'client-browser' },
        { cpuTimeMs: 100, pid: 5002, role: 'app-server' },
        { cpuTimeMs: 100, pid: 5003, role: 'websocket-server' }
      ],
      trackedProcessRoles: requiredProcessRoles
    }),
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
          `${TARGET_PGID} 1 ${TARGET_PGID} 12.0 0:00.10 yarn playwright`,
          `5001 ${TARGET_PGID} 5001 40.0 0:00.40 chrome-headless-shell`,
          `5002 ${TARGET_PGID} 5002 4.0 0:00.05 node vite preview`
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
        ASYRA_DESIGN_ENDPOINT_PREVIEW_OUT_DIR:
          '/project/apps/asyra-design/tmp/asyra-design-endpoint-preview/current',
        ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED: 'a'.repeat(64),
        ASYRA_DESIGN_ENDPOINT_RESPONSE_MANIFEST_PATH:
          '/project/apps/asyra-design/tmp/asyra-design-endpoint-preview/current/__endpoint-test__/server-responses/manifest.json',
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
        globalThis.queueMicrotask(() => child.emit('close', 0, null))
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
  assert.equal(
    spawnCall.options.env.ASYRA_DESIGN_ENDPOINT_PREVIEW_OUT_DIR,
    undefined
  )
  assert.equal(
    spawnCall.options.env.ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED,
    undefined
  )
  assert.equal(
    spawnCall.options.env.ASYRA_DESIGN_ENDPOINT_RESPONSE_MANIFEST_PATH,
    undefined
  )
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

test('attests separate production setup before starting guarded runtime', async () => {
  const events = []
  const expectedEndpoint = 'ws://127.0.0.1:4121/asyra-design-collaboration'
  const expectedPreviewOutDir =
    '/project/apps/asyra-design/tmp/asyra-design-endpoint-preview/current'
  const expectedManifestPath = `${expectedPreviewOutDir}/__endpoint-test__/server-responses/manifest.json`
  const expectedProductionIndexSha256 = 'a'.repeat(64)
  const result = await runEndpointPerformancePipeline(['--owner', OWNER], {
    assertPortAvailable: async (port) => {
      events.push(`port:${port}`)
    },
    attestBuild: async ({ expectedEndpoint: actualEndpoint }) => {
      assert.equal(actualEndpoint, expectedEndpoint)
      events.push('attest-build')
      return { assetsInspected: 2, endpoint: actualEndpoint }
    },
    attestResponsePreview: async () => {
      events.push('attest-response-preview')
      return {
        currentPath: expectedPreviewOutDir,
        manifest: {
          variants: [
            { itemCount: 16 },
            { itemCount: 320 },
            { itemCount: 1280 },
            { itemCount: 7075 }
          ]
        },
        manifestPath: expectedManifestPath,
        productionIndexSha256: expectedProductionIndexSha256
      }
    },
    baseEnv: { PATH: '/test/bin' },
    runPhase: async (argv, options) => {
      const phaseOwner = argv[1]
      assert.equal(phaseOwner, OWNER)
      events.push(`runtime:${phaseOwner}`)
      assert.equal(
        options.baseEnv.ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED,
        expectedEndpoint
      )
      assert.equal(
        options.baseEnv.ASYRA_DESIGN_ENDPOINT_PREVIEW_OUT_DIR,
        expectedPreviewOutDir
      )
      assert.equal(
        options.baseEnv.ASYRA_DESIGN_ENDPOINT_RESPONSE_MANIFEST_PATH,
        expectedManifestPath
      )
      assert.equal(
        options.baseEnv.ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED,
        expectedProductionIndexSha256
      )
      assert.equal(
        options.baseEnv.ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_PAYLOAD,
        undefined
      )
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
    'attest-build',
    'attest-response-preview',
    `runtime:${OWNER}`
  ])
})

test('does not start the guarded runtime when production artifact attestation fails', async () => {
  const events = []
  await assert.rejects(
    runEndpointPerformancePipeline(['--owner', OWNER], {
      assertPortAvailable: async () => undefined,
      attestBuild: async () => {
        events.push('attest-build')
        throw new Error('production setup is stale')
      },
      baseEnv: { PATH: '/test/bin' },
      runPhase: async () => {
        events.push('runtime')
        return { exitCode: 0, report: null }
      }
    }),
    /production setup is stale/
  )

  assert.deepEqual(events, ['attest-build'])
})

test('does not spawn the guarded runtime when response overlay manifest or gzip attestation fails', async () => {
  const events = []
  await assert.rejects(
    runEndpointPerformancePipeline(['--owner', OWNER], {
      assertPortAvailable: async (port) => {
        events.push(`port:${port}`)
      },
      attestBuild: async ({ expectedEndpoint }) => {
        events.push('attest-build')
        return { assetsInspected: 1, endpoint: expectedEndpoint }
      },
      attestResponsePreview: async () => {
        events.push('attest-response-preview')
        throw new Error('prepared response manifest gzip sha256 mismatch')
      },
      baseEnv: { PATH: '/test/bin' },
      runPhase: async () => {
        events.push('runtime-spawn')
        return { exitCode: 0, report: null }
      }
    }),
    /manifest gzip sha256 mismatch/i
  )

  assert.deepEqual(events, [
    'port:3021',
    'port:4121',
    'attest-build',
    'attest-response-preview'
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
              })),
              visibleWorkerTargets: [
                ...Array.from(
                  { length: 20 },
                  (_, index) => `http://127.0.0.1/worker-${index}.js`
                ),
                '',
                { invalid: true }
              ]
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
          proofKind: 'endpoint',
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
  assert.deepEqual(
    report.endpointReport.actorA.diagnostics.visibleWorkerTargets,
    Array.from(
      { length: 16 },
      (_, index) => `http://127.0.0.1/worker-${index}.js`
    )
  )
  assert.equal(Object.hasOwn(report.endpointReport, 'ignoredPayload'), false)
})
