import { Buffer } from 'node:buffer'
import { execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { resolve } from 'node:path'
import process from 'node:process'
import {
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout
} from 'node:timers'
import { fileURLToPath } from 'node:url'

export const DEFAULT_RESOURCE_GUARD_CONFIG = Object.freeze({
  maximumCpuPercent: 150,
  busyCpuPercent: 80,
  heartbeatStaleMs: 10_000,
  progressStaleMs: 20_000,
  sampleIntervalMs: 250,
  sampleTimeoutMs: 200,
  terminationGraceMs: 3_000,
  historyLimit: 8,
  requestBodyLimitBytes: 64 * 1024
})

const DIAGNOSTIC_MAXIMUM_CPU_PERCENT = 200
const HEARTBEAT_KINDS = new Set(['ready', 'progress', 'complete', 'failed'])
const MAX_CPU_CONTRIBUTORS = 4
const PROCESS_CPU_ROLES = new Set([
  'app-server',
  'client-browser',
  'test-harness',
  'unknown',
  'websocket-server'
])

const mergeConfig = (config = {}) => {
  const guardMode = config.guardMode === 'diagnostic' ? 'diagnostic' : 'proof'
  const maximumCpuPercentCeiling =
    guardMode === 'diagnostic'
      ? DIAGNOSTIC_MAXIMUM_CPU_PERCENT
      : DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent

  return {
    ...DEFAULT_RESOURCE_GUARD_CONFIG,
    ...config,
    guardMode,
    maximumCpuPercent: Math.min(
      maximumCpuPercentCeiling,
      Math.max(
        0,
        config.maximumCpuPercent ??
          DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent
      )
    ),
    busyCpuPercent: Math.min(
      DEFAULT_RESOURCE_GUARD_CONFIG.busyCpuPercent,
      Math.max(
        0,
        config.busyCpuPercent ?? DEFAULT_RESOURCE_GUARD_CONFIG.busyCpuPercent
      )
    ),
    sampleIntervalMs: Math.min(
      DEFAULT_RESOURCE_GUARD_CONFIG.sampleIntervalMs,
      Math.max(
        50,
        config.sampleIntervalMs ??
          DEFAULT_RESOURCE_GUARD_CONFIG.sampleIntervalMs
      )
    ),
    sampleTimeoutMs: Math.min(
      DEFAULT_RESOURCE_GUARD_CONFIG.sampleTimeoutMs,
      Math.max(
        50,
        config.sampleTimeoutMs ?? DEFAULT_RESOURCE_GUARD_CONFIG.sampleTimeoutMs
      )
    ),
    terminationGraceMs: Math.min(
      DEFAULT_RESOURCE_GUARD_CONFIG.terminationGraceMs,
      Math.max(0, config.terminationGraceMs ?? 3_000)
    ),
    historyLimit: Math.max(
      1,
      Math.min(
        32,
        config.historyLimit ?? DEFAULT_RESOURCE_GUARD_CONFIG.historyLimit
      )
    )
  }
}

const keepLast = (values, limit) =>
  values.length <= limit ? values : values.slice(values.length - limit)

const isFiniteNonNegativeNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isNonEmptyBoundedString = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 160

const createEmptyRoleCpuPercent = () => ({
  appServer: 0,
  clientBrowser: 0,
  testHarness: 0,
  unknown: 0,
  websocketServer: 0
})

const classifyProcessCommand = (command) => {
  const lowerCommand = command.toLowerCase()
  if (
    lowerCommand.includes('dist/collaboration-server/collaboration-server.js')
  ) {
    return { executable: 'node', role: 'websocket-server' }
  }
  if (lowerCommand.includes('vite') && lowerCommand.includes('preview')) {
    return { executable: 'node', role: 'app-server' }
  }
  if (
    lowerCommand.includes('chrome-headless-shell') ||
    lowerCommand.includes('chromium')
  ) {
    return {
      executable: 'chrome-headless-shell',
      role: 'client-browser'
    }
  }
  if (
    lowerCommand.includes('playwright') ||
    lowerCommand.includes('vitest') ||
    lowerCommand.includes('tinypool') ||
    lowerCommand.includes('esbuild') ||
    lowerCommand.includes('prettier') ||
    lowerCommand.includes('/.yarn/releases/') ||
    lowerCommand.includes('performance-resource-guard') ||
    /(^|\s)yarn(\s|$)/u.test(lowerCommand)
  ) {
    const executable = lowerCommand.includes('esbuild')
      ? 'esbuild'
      : lowerCommand.includes('yarn')
        ? 'yarn'
        : 'node'
    return { executable, role: 'test-harness' }
  }
  const firstToken = command.trim().split(/\s+/u)[0] ?? 'unknown'
  return {
    executable: (firstToken.split('/').at(-1) || 'unknown').slice(0, 160),
    role: 'unknown'
  }
}

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

const sanitizeRoleCpuPercent = (value) => {
  const result = createEmptyRoleCpuPercent()
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result
  }
  for (const key of Object.keys(result)) {
    if (isFiniteNonNegativeNumber(value[key])) {
      result[key] = value[key]
    }
  }
  return result
}

const sanitizeCpuContributors = (value) => {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .flatMap((contributor) => {
      if (
        !contributor ||
        typeof contributor !== 'object' ||
        Array.isArray(contributor) ||
        !Number.isSafeInteger(contributor.pid) ||
        contributor.pid <= 0 ||
        !Number.isSafeInteger(contributor.parentPid) ||
        contributor.parentPid < 0 ||
        !isFiniteNonNegativeNumber(contributor.cpuPercent) ||
        !isNonEmptyBoundedString(contributor.executable)
      ) {
        return []
      }
      return [
        {
          pid: contributor.pid,
          parentPid: contributor.parentPid,
          cpuPercent: contributor.cpuPercent,
          executable: contributor.executable,
          ...(PROCESS_CPU_ROLES.has(contributor.role)
            ? { role: contributor.role }
            : {})
        }
      ]
    })
    .sort(
      (left, right) =>
        right.cpuPercent - left.cpuPercent || left.pid - right.pid
    )
    .slice(0, MAX_CPU_CONTRIBUTORS)
}

const sanitizeScalarRecord = (value, maximumKeys = 32) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const result = {}
  for (const [key, item] of Object.entries(value).slice(0, maximumKeys)) {
    if (
      item === null ||
      typeof item === 'boolean' ||
      (typeof item === 'number' && Number.isFinite(item)) ||
      (typeof item === 'string' && item.length <= 160)
    ) {
      result[key] = item
    }
  }
  return result
}

const sanitizeActor = (actor) => ({
  ...sanitizeScalarRecord(actor),
  elements: actor.elements,
  total: actor.total,
  complete: actor.complete
})

const sanitizeTopPhases = (value) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.slice(0, 24).flatMap((phase) => {
    if (
      !phase ||
      typeof phase !== 'object' ||
      Array.isArray(phase) ||
      !isNonEmptyBoundedString(phase.name) ||
      !isFiniteNonNegativeNumber(phase.durationMs)
    ) {
      return []
    }
    return [
      {
        durationMs: phase.durationMs,
        name: phase.name
      }
    ]
  })
}

const sanitizeWhiteBackgrounds = (value) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.slice(0, 4).flatMap((background) => {
    if (
      !background ||
      typeof background !== 'object' ||
      Array.isArray(background) ||
      !isNonEmptyBoundedString(background.id) ||
      !isFiniteNonNegativeNumber(background.width) ||
      !isFiniteNonNegativeNumber(background.height)
    ) {
      return []
    }
    return [
      {
        height: background.height,
        id: background.id,
        width: background.width
      }
    ]
  })
}

const sanitizeEndpointActor = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const diagnostics =
    value.diagnostics &&
    typeof value.diagnostics === 'object' &&
    !Array.isArray(value.diagnostics)
      ? value.diagnostics
      : {}
  const summary =
    value.summary &&
    typeof value.summary === 'object' &&
    !Array.isArray(value.summary)
      ? value.summary
      : {}
  return {
    ...sanitizeScalarRecord(value),
    diagnostics: {
      ...sanitizeScalarRecord(diagnostics),
      configuration: sanitizeScalarRecord(diagnostics.configuration),
      renderProjectionAnomalies: sanitizeScalarRecord(
        diagnostics.renderProjectionAnomalies
      ),
      topPhases: sanitizeTopPhases(diagnostics.topPhases)
    },
    summary: {
      ...sanitizeScalarRecord(summary),
      whiteBackgrounds: sanitizeWhiteBackgrounds(summary.whiteBackgrounds)
    }
  }
}

const sanitizeEndpointReport = (value, expectedOwner) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.owner !== expectedOwner ||
    value.status !== 'complete'
  ) {
    return null
  }
  const actorA = sanitizeEndpointActor(value.actorA)
  const actorB = sanitizeEndpointActor(value.actorB)
  if (!actorA || !actorB) {
    return null
  }
  return {
    ...sanitizeScalarRecord(value),
    actorA,
    actorB,
    owner: expectedOwner,
    status: 'complete'
  }
}

const sanitizeHeartbeat = (heartbeat) => {
  const base = sanitizeScalarRecord(heartbeat)
  return {
    ...base,
    owner: heartbeat.owner,
    phase: heartbeat.phase,
    actorA: sanitizeActor(heartbeat.actorA),
    actorB: sanitizeActor(heartbeat.actorB),
    publications: sanitizeScalarRecord(heartbeat.publications),
    ownerTiming: sanitizeScalarRecord(heartbeat.ownerTiming)
  }
}

const isElementCount = (value) => Number.isSafeInteger(value) && value >= 0

const validateActor = (actor) =>
  actor &&
  typeof actor === 'object' &&
  !Array.isArray(actor) &&
  isElementCount(actor.canonicalElements) &&
  isElementCount(actor.elements) &&
  isElementCount(actor.renderProjectionElements) &&
  isElementCount(actor.total) &&
  typeof actor.complete === 'boolean'

const isActorExactlyComplete = (actor) =>
  actor.complete === true &&
  actor.canonicalElements === actor.total &&
  actor.elements === actor.total &&
  actor.renderProjectionElements === actor.total

const validateHeartbeat = (heartbeat, expectedOwner) => {
  if (!heartbeat || typeof heartbeat !== 'object' || Array.isArray(heartbeat)) {
    return 'invalid-heartbeat'
  }
  if (
    !isNonEmptyBoundedString(heartbeat.owner) ||
    heartbeat.owner !== expectedOwner
  ) {
    return 'invalid-owner'
  }
  if (!isNonEmptyBoundedString(heartbeat.phase)) {
    return 'invalid-phase'
  }
  if (!validateActor(heartbeat.actorA) || !validateActor(heartbeat.actorB)) {
    return 'invalid-actor-progress'
  }
  if (
    !heartbeat.ownerTiming ||
    typeof heartbeat.ownerTiming !== 'object' ||
    Array.isArray(heartbeat.ownerTiming) ||
    !isNonEmptyBoundedString(heartbeat.ownerTiming.actorAPhase) ||
    !isFiniteNonNegativeNumber(heartbeat.ownerTiming.actorADurationMs) ||
    !isNonEmptyBoundedString(heartbeat.ownerTiming.actorBPhase) ||
    !isFiniteNonNegativeNumber(heartbeat.ownerTiming.actorBDurationMs)
  ) {
    return 'invalid-owner-timing'
  }
  return null
}

export const createResourceGuardState = ({
  nowMs = Date.now(),
  config
} = {}) => {
  const normalizedConfig = mergeConfig(config)
  return {
    config: normalizedConfig,
    startedAtMs: nowMs,
    ready: false,
    readyAtMs: null,
    finished: false,
    acceptedProcessSamples: 0,
    lastHeartbeatAtMs: null,
    lastProgressAtMs: nowMs,
    lastHeartbeat: null,
    endpointReport: null,
    heartbeatSamples: [],
    cpuSamples: [],
    maximumCpuSample: null,
    sampleFailure: null,
    profileRemainder: '',
    profileMetrics: {
      counts: {
        profile: 0,
        peerWrite: 0,
        peerDrain: 0,
        peerApplied: 0
      },
      maximums: {
        writeCallbackMs: 0,
        drainMs: 0,
        queueWaitMs: 0,
        totalMs: 0,
        queueBytes: 0
      },
      recent: []
    },
    stopDecision: null
  }
}

export const recordResourceHeartbeat = (
  state,
  body,
  { expectedToken, expectedOwner, nowMs = Date.now() }
) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { accepted: false, reason: 'invalid-body', state }
  }
  if (
    typeof expectedToken !== 'string' ||
    expectedToken.length === 0 ||
    body.token !== expectedToken
  ) {
    return { accepted: false, reason: 'invalid-token', state }
  }
  if (!HEARTBEAT_KINDS.has(body.kind)) {
    return { accepted: false, reason: 'invalid-kind', state }
  }

  const validationFailure = validateHeartbeat(body.heartbeat, expectedOwner)
  if (validationFailure) {
    return { accepted: false, reason: validationFailure, state }
  }
  if (body.kind === 'ready' && state.acceptedProcessSamples < 1) {
    return { accepted: false, reason: 'guard-not-armed', state }
  }
  if (!state.ready && body.kind !== 'ready' && body.kind !== 'failed') {
    return { accepted: false, reason: 'guard-not-ready', state }
  }

  const heartbeat = sanitizeHeartbeat(body.heartbeat)
  if (
    body.kind === 'complete' &&
    (!isActorExactlyComplete(heartbeat.actorA) ||
      !isActorExactlyComplete(heartbeat.actorB))
  ) {
    return { accepted: false, reason: 'incomplete-proof', state }
  }
  const endpointReport =
    body.kind === 'complete'
      ? sanitizeEndpointReport(body.heartbeat.report, expectedOwner)
      : state.endpointReport
  if (body.kind === 'complete' && endpointReport === null) {
    return { accepted: false, reason: 'invalid-endpoint-report', state }
  }
  const previous = state.lastHeartbeat
  const madeProgress =
    !previous ||
    heartbeat.actorA.elements > previous.actorA.elements ||
    heartbeat.actorB.elements > previous.actorB.elements
  const config = state.config ?? mergeConfig()
  const heartbeatSample = {
    kind: body.kind,
    receivedAtMs: nowMs,
    phase: heartbeat.phase,
    actorAElements: heartbeat.actorA.elements,
    actorBElements: heartbeat.actorB.elements
  }

  return {
    accepted: true,
    reason: null,
    state: {
      ...state,
      ready: state.ready || body.kind === 'ready',
      readyAtMs: state.readyAtMs ?? (body.kind === 'ready' ? nowMs : null),
      finished:
        state.finished || body.kind === 'complete' || body.kind === 'failed',
      lastHeartbeatAtMs: nowMs,
      lastProgressAtMs: madeProgress ? nowMs : state.lastProgressAtMs,
      lastHeartbeat: heartbeat,
      endpointReport,
      heartbeatSamples: keepLast(
        [...state.heartbeatSamples, heartbeatSample],
        config.historyLimit
      )
    }
  }
}

const noStopDecision = Object.freeze({
  stop: false,
  reason: null,
  triggeredAtMs: null
})

const stopDecision = (reason, nowMs) => ({
  stop: true,
  reason,
  triggeredAtMs: nowMs
})

export const evaluateResourceSample = (
  state,
  sample,
  { targetPgid, config }
) => {
  const normalizedConfig = mergeConfig({
    ...state.config,
    ...config
  })
  if (
    !Number.isSafeInteger(targetPgid) ||
    targetPgid <= 0 ||
    !sample ||
    sample.pgid !== targetPgid
  ) {
    return {
      accepted: false,
      reason: 'untracked-process-group',
      state,
      decision: state.stopDecision ?? noStopDecision
    }
  }
  if (
    !isFiniteNonNegativeNumber(sample.cpuPercent) ||
    !isFiniteNonNegativeNumber(sample.nowMs)
  ) {
    return {
      accepted: false,
      reason: 'invalid-process-sample',
      state,
      decision: state.stopDecision ?? noStopDecision
    }
  }

  const cpuSample = {
    pgid: targetPgid,
    cpuPercent: sample.cpuPercent,
    contributors: sanitizeCpuContributors(sample.contributors),
    roleCpuPercent: sanitizeRoleCpuPercent(sample.roleCpuPercent),
    sampledAtMs: sample.nowMs
  }
  const cpuSamples = keepLast(
    [...state.cpuSamples, cpuSample],
    normalizedConfig.historyLimit
  )
  const maximumCpuSample =
    !state.maximumCpuSample ||
    sample.cpuPercent > state.maximumCpuSample.cpuPercent
      ? cpuSample
      : state.maximumCpuSample

  let decision = state.stopDecision
  if (!decision && sample.cpuPercent > normalizedConfig.maximumCpuPercent) {
    decision = stopDecision('cpu-limit-exceeded', sample.nowMs)
  }

  const hostIsBusy = sample.cpuPercent > normalizedConfig.busyCpuPercent
  if (
    !decision &&
    hostIsBusy &&
    state.ready &&
    state.lastHeartbeatAtMs !== null &&
    sample.nowMs - state.lastHeartbeatAtMs > normalizedConfig.heartbeatStaleMs
  ) {
    decision = stopDecision('heartbeat-stale', sample.nowMs)
  }

  const bothActorsComplete =
    state.lastHeartbeat?.actorA.complete === true &&
    state.lastHeartbeat?.actorB.complete === true
  if (
    !decision &&
    hostIsBusy &&
    state.ready &&
    !bothActorsComplete &&
    sample.nowMs - state.lastProgressAtMs > normalizedConfig.progressStaleMs
  ) {
    decision = stopDecision('progress-stale', sample.nowMs)
  }

  const nextState = {
    ...state,
    config: normalizedConfig,
    acceptedProcessSamples: state.acceptedProcessSamples + 1,
    cpuSamples,
    maximumCpuSample,
    stopDecision: decision
  }
  return {
    accepted: true,
    reason: null,
    state: nextState,
    decision: decision ?? noStopDecision
  }
}

export const recordResourceSampleFailure = (
  state,
  { targetPgid, nowMs = Date.now(), error }
) => {
  const decision =
    state.stopDecision ?? stopDecision('resource-sample-failed', nowMs)
  const message = String(
    error?.message ?? error ?? 'unknown sampling failure'
  ).slice(0, 500)
  const errorCode =
    typeof error?.code === 'string' || typeof error?.code === 'number'
      ? error.code
      : null
  const signal =
    typeof error?.signal === 'string' && error.signal.length <= 32
      ? error.signal
      : null
  const nextState = {
    ...state,
    sampleFailure: {
      pgid: targetPgid,
      atMs: nowMs,
      errorCode,
      killed: error?.killed === true,
      message,
      signal,
      timeoutMs:
        state.config?.sampleTimeoutMs ??
        DEFAULT_RESOURCE_GUARD_CONFIG.sampleTimeoutMs
    },
    stopDecision: decision
  }
  return {
    state: nextState,
    decision
  }
}

export const classifyGuardedChildExit = (
  state,
  childExit,
  { requiresReady = true, nowMs = Date.now() } = {}
) => {
  if (
    !state.stopDecision &&
    requiresReady &&
    childExit.code === 0 &&
    !state.ready
  ) {
    const decision = stopDecision('guard-never-ready', nowMs)
    return {
      ok: false,
      state: {
        ...state,
        stopDecision: decision
      },
      decision
    }
  }
  if (
    !state.stopDecision &&
    requiresReady &&
    childExit.code === 0 &&
    (!state.finished || state.endpointReport === null)
  ) {
    const decision = stopDecision('guard-never-complete', nowMs)
    return {
      ok: false,
      state: {
        ...state,
        stopDecision: decision
      },
      decision
    }
  }

  const ok =
    !state.stopDecision &&
    childExit.error === null &&
    childExit.signal === null &&
    childExit.code === 0
  return {
    ok,
    state,
    decision: state.stopDecision ?? noStopDecision
  }
}

const PROFILE_PREFIXES = Object.freeze([
  {
    prefix: 'AI_COLLABORATION_SERVER_PROFILE ',
    key: 'profile'
  },
  {
    prefix: 'AI_COLLABORATION_SERVER_PEER_WRITE ',
    key: 'peerWrite'
  },
  {
    prefix: 'AI_COLLABORATION_SERVER_PEER_DRAIN ',
    key: 'peerDrain'
  },
  {
    prefix: 'AI_COLLABORATION_SERVER_PEER_APPLIED ',
    key: 'peerApplied'
  }
])

const maximum = (current, candidate) =>
  isFiniteNonNegativeNumber(candidate) ? Math.max(current, candidate) : current

const parseProfileLine = (line) => {
  for (const candidate of PROFILE_PREFIXES) {
    const prefixIndex = line.indexOf(candidate.prefix)
    if (prefixIndex < 0) {
      continue
    }
    const json = line.slice(prefixIndex + candidate.prefix.length).trim()
    try {
      const parsed = JSON.parse(json)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null
      }
      return {
        type: candidate.key,
        evidence: sanitizeScalarRecord(parsed)
      }
    } catch {
      return null
    }
  }
  return null
}

export const recordProfileOutput = (state, chunk, { flush = false } = {}) => {
  const combined = `${state.profileRemainder ?? ''}${String(chunk)}`
  const lines = combined.split(/\r?\n/u)
  const trailing = lines.pop() ?? ''
  const remainder = flush ? '' : trailing
  if (flush && trailing) {
    lines.push(trailing)
  }

  const config = state.config ?? mergeConfig()
  let profileMetrics = state.profileMetrics
  for (const line of lines) {
    const metric = parseProfileLine(line)
    if (!metric) {
      continue
    }
    const evidence = metric.evidence
    profileMetrics = {
      counts: {
        ...profileMetrics.counts,
        [metric.type]: profileMetrics.counts[metric.type] + 1
      },
      maximums: {
        writeCallbackMs: maximum(
          profileMetrics.maximums.writeCallbackMs,
          evidence.writeCallbackMs
        ),
        drainMs: maximum(profileMetrics.maximums.drainMs, evidence.drainMs),
        queueWaitMs: maximum(
          profileMetrics.maximums.queueWaitMs,
          evidence.queueWaitMs
        ),
        totalMs: maximum(profileMetrics.maximums.totalMs, evidence.totalMs),
        queueBytes: maximum(
          profileMetrics.maximums.queueBytes,
          evidence.queueBytes
        )
      },
      recent: keepLast(
        [
          ...profileMetrics.recent,
          {
            type: metric.type,
            ...evidence
          }
        ],
        config.historyLimit
      )
    }
  }

  return {
    ...state,
    profileRemainder: remainder.slice(-1_024),
    profileMetrics
  }
}

export const buildBoundedResourceReport = (
  state,
  {
    owner,
    targetPgid,
    termination = null,
    childExit = null,
    childOutputTail = []
  }
) => {
  const heartbeat = state.lastHeartbeat
  const historyLimit = state.config?.historyLimit ?? 8
  return {
    owner,
    targetPgid,
    stopped: state.stopDecision?.stop === true,
    stopReason: state.stopDecision?.reason ?? null,
    triggeredAtMs: state.stopDecision?.triggeredAtMs ?? null,
    ready: state.ready,
    finished: state.finished,
    phase: heartbeat?.phase ?? null,
    actorA: heartbeat?.actorA ?? null,
    actorB: heartbeat?.actorB ?? null,
    publications: heartbeat?.publications ?? {},
    ownerTiming: heartbeat?.ownerTiming ?? {},
    heartbeats: keepLast(state.heartbeatSamples, historyLimit),
    cpuSamples: keepLast(state.cpuSamples, historyLimit),
    maximumCpuSample: state.maximumCpuSample,
    sampleFailure: state.sampleFailure,
    profileMetrics: state.profileMetrics,
    endpointReport: state.endpointReport,
    termination,
    childExit,
    childOutputTail: keepLast(
      childOutputTail.map((line) => String(line).slice(0, 500)),
      historyLimit
    )
  }
}

const isMissingProcessError = (error) =>
  error &&
  typeof error === 'object' &&
  (error.code === 'ESRCH' || error.code === 'ENOENT')

const defaultKill = async (pid, signal) => {
  process.kill(pid, signal)
}

const defaultWait = (milliseconds) =>
  new Promise((resolveWait) => {
    setTimeout(resolveWait, milliseconds)
  })

const defaultProbe = async (pgid) => {
  try {
    process.kill(-pgid, 0)
    return true
  } catch (error) {
    if (isMissingProcessError(error)) {
      return false
    }
    throw error
  }
}

export const installTrackedProcessLifecycleGuard = ({
  pgid,
  startTermination,
  runtimeProcess = process,
  emergencyKill = (pid, signal) => process.kill(pid, signal)
}) => {
  if (!Number.isSafeInteger(pgid) || pgid <= 0) {
    throw new TypeError('A positive tracked process-group ID is required')
  }
  if (typeof startTermination !== 'function') {
    throw new TypeError('A tracked process-group termination owner is required')
  }

  let disposed = false
  const signalHandlers = new Map()
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    const handler = () => {
      if (disposed) return
      try {
        void Promise.resolve(startTermination(signal)).catch(() => undefined)
      } catch {
        // The synchronous exit hook remains the final exact-PGID fallback.
      }
    }
    signalHandlers.set(signal, handler)
    runtimeProcess.on(signal, handler)
  }
  const handleExit = () => {
    if (disposed) return
    try {
      emergencyKill(-pgid, 'SIGKILL')
    } catch (error) {
      if (!isMissingProcessError(error)) {
        // Exit hooks cannot recover or broaden their process target.
      }
    }
  }
  runtimeProcess.on('exit', handleExit)

  return () => {
    if (disposed) return
    disposed = true
    signalHandlers.forEach((handler, signal) => {
      runtimeProcess.removeListener(signal, handler)
    })
    runtimeProcess.removeListener('exit', handleExit)
  }
}

export const terminateTrackedProcessGroup = async ({
  pgid,
  graceMs = DEFAULT_RESOURCE_GUARD_CONFIG.terminationGraceMs,
  kill = defaultKill,
  wait = defaultWait,
  probe = defaultProbe
}) => {
  if (!Number.isSafeInteger(pgid) || pgid <= 0) {
    throw new TypeError('A positive tracked process-group ID is required')
  }

  let termSent = false
  try {
    await kill(-pgid, 'SIGTERM')
    termSent = true
  } catch (error) {
    if (!isMissingProcessError(error)) {
      throw error
    }
  }

  if (!termSent) {
    return { pgid, termSent: false, forceKilled: false }
  }

  await wait(
    Math.min(
      DEFAULT_RESOURCE_GUARD_CONFIG.terminationGraceMs,
      Math.max(0, graceMs)
    )
  )
  const alive = await probe(pgid)
  if (!alive) {
    return { pgid, termSent: true, forceKilled: false }
  }

  try {
    await kill(-pgid, 'SIGKILL')
    return { pgid, termSent: true, forceKilled: true }
  } catch (error) {
    if (isMissingProcessError(error)) {
      return { pgid, termSent: true, forceKilled: false }
    }
    throw error
  }
}

const boundedErrorMessage = (error) =>
  String(error?.message ?? error ?? 'unknown error').slice(0, 500)

export const attemptGuardedTermination = async ({
  pgid,
  graceMs,
  terminate,
  fallbackTerminate = terminateTrackedProcessGroup
}) => {
  const failures = []
  try {
    const result = await terminate({ pgid, graceMs })
    return {
      ...result,
      confirmed: true,
      failures
    }
  } catch (error) {
    failures.push({
      owner: 'primary',
      message: boundedErrorMessage(error)
    })
  }

  try {
    const result = await fallbackTerminate({ pgid, graceMs: 0 })
    return {
      ...result,
      confirmed: true,
      failures
    }
  } catch (error) {
    failures.push({
      owner: 'fallback',
      message: boundedErrorMessage(error)
    })
    return {
      pgid,
      termSent: false,
      forceKilled: false,
      confirmed: false,
      failures
    }
  }
}

export const parseRunnerArguments = (argv) => {
  let owner = null
  let separatorIndex = -1

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') {
      separatorIndex = index
      break
    }
    if (argument === '--owner') {
      owner = argv[index + 1]
      index += 1
      continue
    }
    if (argument.startsWith('--owner=')) {
      owner = argument.slice('--owner='.length)
      continue
    }
    throw new Error(`Unknown resource-guard option: ${argument}`)
  }

  if (!isNonEmptyBoundedString(owner)) {
    throw new Error('Resource-guard runner requires --owner')
  }
  if (separatorIndex < 0 || separatorIndex >= argv.length - 1) {
    throw new Error('Resource-guard runner requires a command after --')
  }

  return {
    owner,
    command: argv[separatorIndex + 1],
    args: argv.slice(separatorIndex + 2)
  }
}

export const buildRunnerSpawnOptions = ({
  owner,
  guardUrl,
  guardToken,
  baseEnv = process.env
}) => ({
  cwd: process.cwd(),
  detached: true,
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...baseEnv,
    ASYRA_DESIGN_ENDPOINT_OWNER: owner,
    ASYRA_DESIGN_ENDPOINT_GUARD_URL: guardUrl,
    ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN: guardToken
  }
})

const normalizePort = (value, fallback, name) => {
  const port = value === undefined ? fallback : Number(value)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port`)
  }
  return port
}

export const buildEndpointPerformancePhases = ({
  owner,
  baseEnv = process.env
}) => {
  if (!isNonEmptyBoundedString(owner)) {
    throw new Error('Endpoint performance pipeline requires an owner')
  }
  const appPort = normalizePort(
    baseEnv.ASYRA_DESIGN_ENDPOINT_APP_PORT,
    3_021,
    'ASYRA_DESIGN_ENDPOINT_APP_PORT'
  )
  const collaborationPort = normalizePort(
    baseEnv.ASYRA_DESIGN_ENDPOINT_COLLABORATION_PORT,
    4_121,
    'ASYRA_DESIGN_ENDPOINT_COLLABORATION_PORT'
  )
  const collaborationUrl = `ws://127.0.0.1:${collaborationPort}/asyra-design-collaboration`
  const sharedEnv = {
    ...baseEnv,
    ASYRA_DESIGN_ENDPOINT_APP_PORT: String(appPort),
    ASYRA_DESIGN_ENDPOINT_COLLABORATION_PORT: String(collaborationPort),
    ASYRA_DESIGN_APP_URL: `http://127.0.0.1:${appPort}`,
    ASYRA_DESIGN_COLLABORATION_WS_PORT: String(collaborationPort),
    ASYRA_DESIGN_E2E_OWN_SERVERS: '1',
    ASYRA_DESIGN_COLLABORATION_PROFILE: '1',
    VITE_ASYRA_DESIGN_COLLABORATION_WS_URL: collaborationUrl
  }

  return [
    {
      name: 'collaboration-build',
      argv: [
        '--owner',
        `${owner}:collaboration-build`,
        '--',
        'yarn',
        'build:collaboration-server'
      ],
      baseEnv: sharedEnv,
      requiresReady: false,
      ports: [appPort, collaborationPort]
    },
    {
      name: 'app-build',
      argv: ['--owner', `${owner}:app-build`, '--', 'yarn', 'react:build'],
      baseEnv: sharedEnv,
      requiresReady: false,
      ports: [appPort, collaborationPort]
    },
    {
      name: 'playwright',
      argv: [
        '--owner',
        owner,
        '--',
        'yarn',
        'playwright',
        'test',
        '--config',
        'playwright.endpoint-performance.config.ts',
        '--workers=1'
      ],
      baseEnv: sharedEnv,
      requiresReady: true,
      ports: [appPort, collaborationPort]
    }
  ]
}

const execFilePromise = (implementation, file, args, options) =>
  new Promise((resolveExec, rejectExec) => {
    implementation(file, args, options, (error, stdout) => {
      if (error) {
        rejectExec(error)
        return
      }
      resolveExec(stdout)
    })
  })

export const sampleTrackedProcessGroupCpu = async (
  pgid,
  {
    execFileImpl = execFile,
    nowMs = Date.now(),
    platform = process.platform
  } = {}
) => {
  if (!Number.isSafeInteger(pgid) || pgid <= 0) {
    throw new TypeError('A positive tracked process-group ID is required')
  }
  const processArguments =
    platform === 'darwin'
      ? ['-g', String(pgid), '-o', 'pid=,ppid=,pgid=,%cpu=,command=']
      : ['-Ao', 'pid=,ppid=,pgid=,%cpu=,command=']
  const stdout = await execFilePromise(execFileImpl, 'ps', processArguments, {
    encoding: 'utf8',
    killSignal: 'SIGKILL',
    timeout: DEFAULT_RESOURCE_GUARD_CONFIG.sampleTimeoutMs,
    maxBuffer: 256 * 1024
  })
  let cpuPercent = 0
  const contributors = []
  const roleCpuPercent = createEmptyRoleCpuPercent()
  for (const line of stdout.split(/\r?\n/u)) {
    const match = line
      .trim()
      .match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)(?:\s+(.*))?$/u)
    if (!match || Number(match[3]) !== pgid) {
      continue
    }
    const processCpuPercent = Number(match[4])
    cpuPercent += processCpuPercent
    const command = match[5]?.trim() ?? ''
    if (command.length > 0) {
      const classification = classifyProcessCommand(command)
      roleCpuPercent[roleCpuKey(classification.role)] += processCpuPercent
      contributors.push({
        pid: Number(match[1]),
        parentPid: Number(match[2]),
        cpuPercent: processCpuPercent,
        ...classification
      })
    } else {
      roleCpuPercent.unknown += processCpuPercent
    }
  }
  return {
    pgid,
    cpuPercent,
    contributors: sanitizeCpuContributors(contributors),
    nowMs,
    roleCpuPercent
  }
}

const readBoundedJsonBody = (request, limitBytes) =>
  new Promise((resolveBody, rejectBody) => {
    const chunks = []
    let length = 0
    request.on('data', (chunk) => {
      length += chunk.length
      if (length > limitBytes) {
        const error = new Error('Heartbeat body exceeds the bounded limit')
        error.code = 'BODY_TOO_LARGE'
        rejectBody(error)
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        const error = new Error('Heartbeat body is not valid JSON')
        error.code = 'INVALID_JSON'
        rejectBody(error)
      }
    })
    request.on('error', rejectBody)
  })

const sendJson = (response, statusCode, value) => {
  const body = JSON.stringify(value)
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  })
  response.end(body)
}

const listen = (server) =>
  new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen)
      resolveListen()
    })
  })

const close = (server) =>
  new Promise((resolveClose) => {
    server.close(() => resolveClose())
  })

const appendOutputTail = (tail, chunk, limit) => {
  const nextLines = String(chunk)
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => line.slice(0, 500))
  return keepLast([...tail, ...nextLines], limit)
}

export const runResourceGuardCli = async (
  argv,
  {
    spawnImpl = spawn,
    sampleCpu = sampleTrackedProcessGroupCpu,
    terminate = terminateTrackedProcessGroup,
    fallbackTerminate = terminateTrackedProcessGroup,
    now = Date.now,
    stdout = process.stdout,
    baseEnv = process.env,
    config,
    requiresReady = true,
    runtimeProcess = process,
    emergencyKill,
    setIntervalImpl = setInterval,
    clearIntervalImpl = clearInterval
  } = {}
) => {
  const parsed = parseRunnerArguments(argv)
  const normalizedConfig = mergeConfig(config)
  if (requiresReady && normalizedConfig.guardMode === 'diagnostic') {
    throw new Error(
      'Diagnostic CPU mode cannot run an authenticated endpoint proof'
    )
  }
  const token = randomBytes(24).toString('hex')
  let state = createResourceGuardState({
    nowMs: now(),
    config: normalizedConfig
  })

  const server = createHttpServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/heartbeat') {
      sendJson(response, 404, { accepted: false })
      return
    }
    try {
      const body = await readBoundedJsonBody(
        request,
        normalizedConfig.requestBodyLimitBytes
      )
      const result = recordResourceHeartbeat(state, body, {
        expectedToken: token,
        expectedOwner: parsed.owner,
        nowMs: now()
      })
      state = result.state
      let statusCode = 400
      if (result.accepted) {
        statusCode = 200
      } else if (result.reason === 'invalid-token') {
        statusCode = 401
      } else if (result.reason === 'guard-not-armed') {
        statusCode = 409
      }
      sendJson(response, statusCode, {
        accepted: result.accepted,
        ...(result.reason ? { reason: result.reason } : {})
      })
    } catch (error) {
      sendJson(response, error.code === 'BODY_TOO_LARGE' ? 413 : 400, {
        accepted: false,
        reason:
          error.code === 'BODY_TOO_LARGE' ? 'body-too-large' : 'invalid-json'
      })
    }
  })
  server.requestTimeout = 5_000
  await listen(server)
  const address = server.address()
  if (!address || typeof address === 'string') {
    await close(server)
    throw new Error('Resource-guard server did not bind a local TCP port')
  }
  const guardUrl = `http://127.0.0.1:${address.port}`
  const child = spawnImpl(
    parsed.command,
    parsed.args,
    buildRunnerSpawnOptions({
      owner: parsed.owner,
      guardUrl,
      guardToken: token,
      baseEnv
    })
  )
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0) {
    await close(server)
    throw new Error('Resource-guard runner could not determine Playwright PGID')
  }

  const targetPgid = child.pid
  let outputTail = []
  child.stdout?.on('data', (chunk) => {
    state = recordProfileOutput(state, chunk)
    outputTail = appendOutputTail(
      outputTail,
      chunk,
      normalizedConfig.historyLimit
    )
  })
  child.stderr?.on('data', (chunk) => {
    state = recordProfileOutput(state, chunk)
    outputTail = appendOutputTail(
      outputTail,
      chunk,
      normalizedConfig.historyLimit
    )
  })

  let childClosed = false
  const childClose = new Promise((resolveClose) => {
    child.once('error', (error) => {
      childClosed = true
      resolveClose({
        code: null,
        signal: null,
        error: boundedErrorMessage(error)
      })
    })
    child.once('close', (code, signal) => {
      childClosed = true
      resolveClose({ code, signal, error: null })
    })
  })

  let resolveTerminationStarted = () => undefined
  const terminationStartedSignal = new Promise((resolveStarted) => {
    resolveTerminationStarted = resolveStarted
  })
  let termination = null
  let terminationPromise = null
  let evaluationRunning = false
  let terminationStarted = false
  const startTermination = (reason = 'guard-requested') => {
    if (terminationPromise) {
      return terminationPromise
    }
    if (!state.stopDecision) {
      state = {
        ...state,
        stopDecision: stopDecision(
          `guard-${String(reason).toLowerCase()}`,
          now()
        )
      }
    }
    terminationStarted = true
    terminationPromise = attemptGuardedTermination({
      pgid: targetPgid,
      graceMs: normalizedConfig.terminationGraceMs,
      terminate,
      fallbackTerminate
    }).then((result) => {
      termination = result
      return result
    })
    resolveTerminationStarted()
    return terminationPromise
  }
  const removeLifecycleGuard = installTrackedProcessLifecycleGuard({
    pgid: targetPgid,
    startTermination,
    runtimeProcess,
    ...(emergencyKill ? { emergencyKill } : {})
  })
  const sampleTrackedGroup = async () => {
    if (childClosed || evaluationRunning || terminationStarted) {
      return
    }
    evaluationRunning = true
    try {
      const sample = await sampleCpu(targetPgid)
      if (childClosed) {
        return
      }
      const result = evaluateResourceSample(state, sample, {
        targetPgid,
        config: normalizedConfig
      })
      state = result.state
      if (result.decision.stop) {
        await startTermination()
      }
    } catch (error) {
      if (childClosed) {
        return
      }
      const failure = recordResourceSampleFailure(state, {
        targetPgid,
        nowMs: now(),
        error
      })
      state = failure.state
      outputTail = appendOutputTail(
        outputTail,
        `resource sample failed: ${boundedErrorMessage(error)}`,
        normalizedConfig.historyLimit
      )
      await startTermination()
    } finally {
      evaluationRunning = false
    }
  }
  const interval = setIntervalImpl(() => {
    void sampleTrackedGroup()
  }, normalizedConfig.sampleIntervalMs)
  interval.unref?.()
  await sampleTrackedGroup()

  let serverClosed = false
  const closeGuardServer = async () => {
    if (serverClosed) return
    serverClosed = true
    await close(server)
  }

  try {
    const firstSettlement = await Promise.race([
      childClose.then((childExit) => ({ kind: 'child', childExit })),
      terminationStartedSignal.then(() => ({ kind: 'termination' }))
    ])
    let childExit
    if (firstSettlement.kind === 'child') {
      childExit = firstSettlement.childExit
      if (terminationPromise) {
        await terminationPromise
      }
    } else {
      await terminationPromise
      childExit = await new Promise((resolveExit) => {
        const timeout = setTimeout(
          () =>
            resolveExit({
              code: null,
              signal: null,
              error: 'child-close-timeout'
            }),
          Math.min(5_000, normalizedConfig.terminationGraceMs + 1_000)
        )
        childClose.then((result) => {
          clearTimeout(timeout)
          resolveExit(result)
        })
      })
      if (childExit.error === 'child-close-timeout') {
        outputTail = appendOutputTail(
          outputTail,
          'tracked process group did not close after bounded termination',
          normalizedConfig.historyLimit
        )
        child.stdout?.destroy()
        child.stderr?.destroy()
        child.unref?.()
      }
    }

    clearIntervalImpl(interval)
    while (evaluationRunning) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 10))
    }
    state = recordProfileOutput(state, '', { flush: true })
    const classification = classifyGuardedChildExit(state, childExit, {
      requiresReady,
      nowMs: now()
    })
    state = classification.state
    await closeGuardServer()

    const report = buildBoundedResourceReport(state, {
      owner: parsed.owner,
      targetPgid,
      termination,
      childExit,
      childOutputTail: outputTail
    })
    stdout.write(`${JSON.stringify(report)}\n`)
    return {
      exitCode: state.stopDecision ? 86 : (childExit.code ?? 1),
      report
    }
  } catch (error) {
    if (!childClosed) {
      await startTermination('exception').catch(() => undefined)
    }
    await closeGuardServer()
    throw error
  } finally {
    clearIntervalImpl(interval)
    removeLifecycleGuard()
  }
}

const assertPortAvailable = (port) =>
  new Promise((resolvePort, rejectPort) => {
    const server = createNetServer()
    server.unref()
    server.once('error', (error) => {
      rejectPort(
        new Error(
          `Endpoint performance port ${port} is unavailable: ${error.message}`
        )
      )
    })
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => {
        if (error) {
          rejectPort(error)
          return
        }
        resolvePort()
      })
    })
  })

const parsePipelineArguments = (argv) => {
  if (
    argv.length !== 2 ||
    argv[0] !== '--owner' ||
    !isNonEmptyBoundedString(argv[1])
  ) {
    throw new Error('Endpoint pipeline usage: --owner <inspector-owner>')
  }
  return argv[1]
}

export const runEndpointPerformancePipeline = async (
  argv,
  dependencies = {}
) => {
  const owner = parsePipelineArguments(argv)
  const phases = buildEndpointPerformancePhases({
    owner,
    baseEnv: dependencies.baseEnv ?? process.env
  })
  for (const port of phases[0].ports) {
    await assertPortAvailable(port)
  }

  const results = []
  for (const phase of phases) {
    const result = await runResourceGuardCli(phase.argv, {
      ...dependencies,
      baseEnv: phase.baseEnv,
      requiresReady: phase.requiresReady
    })
    results.push({
      phase: phase.name,
      exitCode: result.exitCode,
      report: result.report
    })
    if (result.exitCode !== 0) {
      return {
        exitCode: result.exitCode,
        phases: results
      }
    }
  }
  return {
    exitCode: 0,
    phases: results
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const argv = process.argv.slice(2)
  const execution = argv.includes('--')
    ? runResourceGuardCli(argv)
    : runEndpointPerformancePipeline(argv)
  execution
    .then((result) => {
      process.exitCode = result.exitCode
    })
    .catch((error) => {
      process.stderr.write(
        `${JSON.stringify({
          type: 'asyra-performance-resource-guard-error',
          message: String(error?.message ?? error).slice(0, 500)
        })}\n`
      )
      process.exitCode = 1
    })
}
