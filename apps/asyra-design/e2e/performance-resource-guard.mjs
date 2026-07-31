#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { execFile, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'
import {
  clearInterval,
  clearTimeout,
  setInterval,
  setTimeout
} from 'node:timers'
import { fileURLToPath, URL } from 'node:url'

export const DEFAULT_RESOURCE_GUARD_CONFIG = Object.freeze({
  maximumCpuPercent: 400,
  maximumFrontendCpuPercent: 250,
  busyCpuPercent: 80,
  heartbeatStaleMs: 10_000,
  progressStaleMs: 20_000,
  sampleIntervalMs: 250,
  maximumSampleGapMs: 375,
  sampleTimeoutMs: 200,
  terminationGraceMs: 3_000,
  historyLimit: 8,
  requestBodyLimitBytes: 64 * 1024
})

const HEARTBEAT_KINDS = new Set(['ready', 'progress', 'complete', 'failed'])
const MAX_CPU_CONTRIBUTORS = 256
const MAX_PROCESS_CPU_TIME_ENTRIES = 256
const PROOF_KINDS = new Set([
  'endpoint',
  'local-attribution',
  'collaboration-attribution'
])
const PROCESS_CPU_ROLES = new Set([
  'app-server',
  'client-browser',
  'test-harness',
  'unknown',
  'websocket-server'
])
const BROWSER_PROCESS_TYPES = new Set([
  'gpu-process',
  'other-browser',
  'renderer-or-worker',
  'root-browser',
  'utility'
])
const TRACKED_PROCESS_ROLES = Object.freeze([
  'test-harness',
  'client-browser',
  'app-server',
  'websocket-server'
])
const TRACKED_PROCESS_ROLE_SET = new Set(TRACKED_PROCESS_ROLES)
const PRODUCT_PROCESS_ROLES = Object.freeze([
  'client-browser',
  'app-server',
  'websocket-server'
])
const TRACKED_PROCESS_REGISTRATION_PATH = '/register-process-group'
const PHASE_BOUNDARY_PATH = '/phase-boundary'
const ENDPOINT_ARTIFACT_ENV = 'ASYRA_DESIGN_ENDPOINT_ARTIFACT_ATTESTED'
const ENDPOINT_PREVIEW_OUT_DIR_ENV = 'ASYRA_DESIGN_ENDPOINT_PREVIEW_OUT_DIR'
const ENDPOINT_RESPONSE_ARTIFACT_ENV =
  'ASYRA_DESIGN_ENDPOINT_RESPONSE_ARTIFACT_ATTESTED'
const ENDPOINT_RESPONSE_MANIFEST_PATH_ENV =
  'ASYRA_DESIGN_ENDPOINT_RESPONSE_MANIFEST_PATH'
const GUARD_ENVIRONMENT_KEYS = Object.freeze([
  'ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN',
  'ASYRA_DESIGN_ENDPOINT_GUARD_URL',
  'ASYRA_DESIGN_ENDPOINT_OWNER',
  ENDPOINT_ARTIFACT_ENV,
  ENDPOINT_PREVIEW_OUT_DIR_ENV,
  ENDPOINT_RESPONSE_ARTIFACT_ENV,
  ENDPOINT_RESPONSE_MANIFEST_PATH_ENV,
  'ASYRA_DESIGN_TRACKED_EXECUTABLE',
  'ASYRA_DESIGN_TRACKED_ROLE'
])

const normalizeRequiredProcessRoles = (value) => {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter(
        (role) => typeof role === 'string' && TRACKED_PROCESS_ROLE_SET.has(role)
      )
    )
  ]
}

const mergeConfig = (config = {}) => {
  const guardMode = config.guardMode === 'diagnostic' ? 'diagnostic' : 'proof'
  const requiredProofKind = PROOF_KINDS.has(config.requiredProofKind)
    ? config.requiredProofKind
    : 'endpoint'
  const maximumCpuPercentCeiling =
    DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent
  const maximumFrontendCpuPercentCeiling =
    requiredProofKind === 'endpoint'
      ? DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent
      : DEFAULT_RESOURCE_GUARD_CONFIG.maximumFrontendCpuPercent

  return {
    ...DEFAULT_RESOURCE_GUARD_CONFIG,
    ...config,
    guardMode,
    requiredProofKind,
    requiredProcessRoles: normalizeRequiredProcessRoles(
      config.requiredProcessRoles
    ),
    maximumCpuPercent: Math.min(
      maximumCpuPercentCeiling,
      Math.max(
        0,
        config.maximumCpuPercent ??
          DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent
      )
    ),
    maximumFrontendCpuPercent: Math.min(
      maximumFrontendCpuPercentCeiling,
      Math.max(
        0,
        config.maximumFrontendCpuPercent ??
          DEFAULT_RESOURCE_GUARD_CONFIG.maximumFrontendCpuPercent
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
    maximumSampleGapMs: DEFAULT_RESOURCE_GUARD_CONFIG.maximumSampleGapMs,
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

const createEmptyRoleCpuTimeMs = () => ({
  appServer: 0,
  clientBrowser: 0,
  testHarness: 0,
  unknown: 0,
  websocketServer: 0
})

const createEmptyBrowserProcessTypeCpuPercent = () => ({
  gpuProcess: 0,
  otherBrowser: 0,
  rendererOrWorker: 0,
  rootBrowser: 0,
  utility: 0
})

const createEmptyBrowserProcessTypeCpuTimeMs = () => ({
  gpuProcess: 0,
  otherBrowser: 0,
  rendererOrWorker: 0,
  rootBrowser: 0,
  utility: 0
})

export const parseCpuTimeToMilliseconds = (value) => {
  if (typeof value !== 'string') {
    throw new TypeError('Process CPU time must be a string')
  }
  const match = value
    .trim()
    .match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/u)
  if (!match) {
    throw new TypeError(`Invalid process CPU time: ${String(value)}`)
  }
  const days = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3])
  const seconds = Number(match[4])
  if (
    ![days, hours, minutes, seconds].every(Number.isFinite) ||
    seconds >= 60 ||
    (match[2] !== undefined && minutes >= 60) ||
    (match[1] !== undefined && hours >= 24)
  ) {
    throw new TypeError(`Invalid process CPU time: ${value}`)
  }
  return Math.round(
    (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1_000
  )
}

const classifyBrowserProcessType = (lowerCommand) => {
  if (lowerCommand.includes('--type=gpu-process')) return 'gpu-process'
  if (lowerCommand.includes('--type=renderer')) return 'renderer-or-worker'
  if (lowerCommand.includes('--type=utility')) return 'utility'
  if (!lowerCommand.includes('--type=')) return 'root-browser'
  return 'other-browser'
}

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
      browserProcessType: classifyBrowserProcessType(lowerCommand),
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
    let executable = 'node'
    if (lowerCommand.includes('esbuild')) {
      executable = 'esbuild'
    } else if (lowerCommand.includes('yarn')) {
      executable = 'yarn'
    }
    return { executable, role: 'test-harness' }
  }
  const firstToken = command.trim().split(/\s+/u)[0] ?? 'unknown'
  return {
    executable: (firstToken.split('/').at(-1) || 'unknown').slice(0, 160),
    role: 'unknown'
  }
}

const browserProcessTypeCpuKey = (browserProcessType) => {
  switch (browserProcessType) {
    case 'gpu-process':
      return 'gpuProcess'
    case 'renderer-or-worker':
      return 'rendererOrWorker'
    case 'root-browser':
      return 'rootBrowser'
    case 'utility':
      return 'utility'
    default:
      return 'otherBrowser'
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

const sanitizeRoleCpuTimeMs = (value) => {
  const result = createEmptyRoleCpuTimeMs()
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

const sanitizeBrowserProcessTypeCpuPercent = (value) => {
  const result = createEmptyBrowserProcessTypeCpuPercent()
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

const sanitizeProcessCpuTimes = (value) => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_PROCESS_CPU_TIME_ENTRIES
  ) {
    return []
  }
  const pids = new Set()
  const entries = []
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      !Number.isSafeInteger(entry.pid) ||
      entry.pid <= 0 ||
      pids.has(entry.pid) ||
      !PROCESS_CPU_ROLES.has(entry.role) ||
      !isFiniteNonNegativeNumber(entry.cpuTimeMs)
    ) {
      return []
    }
    pids.add(entry.pid)
    let browserProcessType = null
    if (entry.role === 'client-browser') {
      browserProcessType = BROWSER_PROCESS_TYPES.has(entry.browserProcessType)
        ? entry.browserProcessType
        : 'other-browser'
    }
    entries.push({
      ...(browserProcessType ? { browserProcessType } : {}),
      cpuTimeMs: entry.cpuTimeMs,
      pid: entry.pid,
      role: entry.role
    })
  }
  return entries.sort((left, right) => left.pid - right.pid)
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
          ...(Number.isSafeInteger(contributor.pgid) && contributor.pgid > 0
            ? { pgid: contributor.pgid }
            : {}),
          cpuPercent: contributor.cpuPercent,
          executable: contributor.executable,
          ...(BROWSER_PROCESS_TYPES.has(contributor.browserProcessType)
            ? { browserProcessType: contributor.browserProcessType }
            : {}),
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

const sanitizeTrackedProcessGroups = (value) => {
  if (!Array.isArray(value)) return []
  const roles = new Set()
  const pgids = new Set()
  const groups = []
  for (const group of value) {
    if (
      !group ||
      typeof group !== 'object' ||
      Array.isArray(group) ||
      !TRACKED_PROCESS_ROLE_SET.has(group.role) ||
      !Number.isSafeInteger(group.pgid) ||
      group.pgid <= 0 ||
      roles.has(group.role) ||
      pgids.has(group.pgid)
    ) {
      continue
    }
    roles.add(group.role)
    pgids.add(group.pgid)
    groups.push({ pgid: group.pgid, role: group.role })
  }
  return groups.sort(
    (left, right) =>
      TRACKED_PROCESS_ROLES.indexOf(left.role) -
      TRACKED_PROCESS_ROLES.indexOf(right.role)
  )
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

const sanitizeBoundedStrings = (value, maximumEntries = 16) =>
  Array.isArray(value)
    ? value
        .filter(isNonEmptyBoundedString)
        .slice(0, maximumEntries)
        .map((entry) => entry.slice(0, 160))
    : []

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

const sanitizePhaseTimeline = (value) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.slice(0, 128).flatMap((phase) => {
    if (
      !phase ||
      typeof phase !== 'object' ||
      Array.isArray(phase) ||
      !isNonEmptyBoundedString(phase.name) ||
      !isFiniteNonNegativeNumber(phase.atMs) ||
      !isFiniteNonNegativeNumber(phase.durationMs)
    ) {
      return []
    }
    return [
      {
        atMs: phase.atMs,
        durationMs: phase.durationMs,
        name: phase.name
      }
    ]
  })
}

const sanitizeCounterTimeline = (value) => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.slice(0, 64).flatMap((counter) => {
    if (
      !counter ||
      typeof counter !== 'object' ||
      Array.isArray(counter) ||
      !isNonEmptyBoundedString(counter.name) ||
      !isFiniteNonNegativeNumber(counter.atMs) ||
      !isFiniteNonNegativeNumber(counter.value)
    ) {
      return []
    }
    return [
      {
        atMs: counter.atMs,
        name: counter.name,
        value: counter.value
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
      counterTimeline: sanitizeCounterTimeline(diagnostics.counterTimeline),
      phaseTimeline: sanitizePhaseTimeline(diagnostics.phaseTimeline),
      renderProjectionAnomalies: sanitizeScalarRecord(
        diagnostics.renderProjectionAnomalies
      ),
      topPhases: sanitizeTopPhases(diagnostics.topPhases),
      visibleWorkerTargets: sanitizeBoundedStrings(
        diagnostics.visibleWorkerTargets
      )
    },
    summary: {
      ...sanitizeScalarRecord(summary),
      whiteBackgrounds: sanitizeWhiteBackgrounds(summary.whiteBackgrounds)
    }
  }
}

const sanitizeFailureOwnerEvidence = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const sanitizeFailureActor = (actorValue) => {
    if (
      !actorValue ||
      typeof actorValue !== 'object' ||
      Array.isArray(actorValue) ||
      !actorValue.diagnostics ||
      typeof actorValue.diagnostics !== 'object' ||
      Array.isArray(actorValue.diagnostics)
    ) {
      return null
    }
    const diagnostics = actorValue.diagnostics
    return {
      diagnostics: {
        ...sanitizeScalarRecord(diagnostics),
        renderProjectionAnomalies: sanitizeScalarRecord(
          diagnostics.renderProjectionAnomalies
        ),
        topPhases: sanitizeTopPhases(diagnostics.topPhases),
        visibleWorkerTargets: sanitizeBoundedStrings(
          diagnostics.visibleWorkerTargets
        )
      }
    }
  }
  const actorA = sanitizeFailureActor(value.actorA)
  const actorB = sanitizeFailureActor(value.actorB)
  if (!actorA && !actorB) {
    return null
  }
  return {
    actorA,
    actorB
  }
}

const sanitizeFailure = (value) => {
  if (typeof value === 'string' && value.length > 0) {
    return {
      message: value.slice(0, 500),
      name: 'Error'
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const message =
    typeof value.message === 'string' && value.message.length > 0
      ? value.message.slice(0, 500)
      : null
  if (!message) {
    return null
  }
  const ownerEvidence = sanitizeFailureOwnerEvidence(value.ownerEvidence)
  return {
    message,
    name:
      typeof value.name === 'string' && value.name.length > 0
        ? value.name.slice(0, 80)
        : 'Error',
    ...(ownerEvidence ? { ownerEvidence } : {})
  }
}

const sanitizeEndpointReport = (value, expectedOwner, proofKind) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.owner !== expectedOwner ||
    value.proofKind !== proofKind ||
    value.status !== 'complete'
  ) {
    return null
  }
  const actorA = sanitizeEndpointActor(value.actorA)
  let actorB
  if (proofKind === 'local-attribution') {
    actorB = value.actorB === null ? null : undefined
  } else {
    actorB = sanitizeEndpointActor(value.actorB)
  }
  if (
    !actorA ||
    actorB === undefined ||
    (proofKind !== 'local-attribution' && !actorB)
  ) {
    return null
  }
  return {
    ...sanitizeScalarRecord(value),
    actorA,
    actorB,
    owner: expectedOwner,
    proofKind,
    status: 'complete'
  }
}

const sanitizeHeartbeat = (heartbeat) => {
  const base = sanitizeScalarRecord(heartbeat)
  return {
    ...base,
    owner: heartbeat.owner,
    phase: heartbeat.phase,
    proofKind: heartbeat.proofKind,
    actorA: sanitizeActor(heartbeat.actorA),
    actorB: sanitizeActor(heartbeat.actorB),
    publications: sanitizeScalarRecord(heartbeat.publications),
    ownerTiming: sanitizeScalarRecord(heartbeat.ownerTiming),
    ownerEvidence: sanitizeFailureOwnerEvidence(heartbeat.ownerEvidence)
  }
}

const collaborationEndpointPattern =
  /wss?:\/\/[^"'`\s]+\/asyra-design-collaboration/gu

const normalizeCollaborationEndpoint = (value) => {
  if (!isNonEmptyBoundedString(value)) {
    throw new TypeError(
      'Endpoint artifact attestation requires one bounded WebSocket endpoint'
    )
  }
  let endpoint
  try {
    endpoint = new URL(value)
  } catch {
    throw new TypeError(
      'Endpoint artifact attestation requires a valid WebSocket endpoint'
    )
  }
  if (
    !['ws:', 'wss:'].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== '/asyra-design-collaboration' ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new TypeError(
      'Endpoint artifact attestation requires the collaboration WebSocket route'
    )
  }
  return endpoint.href
}

export const attestEndpointBuildArtifact = async ({
  expectedEndpoint,
  assetsDirectory = fileURLToPath(
    new URL('../../../dist/assets/', import.meta.url)
  ),
  readdirImpl = readdir,
  readFileImpl = readFile
}) => {
  const normalizedExpectedEndpoint =
    normalizeCollaborationEndpoint(expectedEndpoint)
  const assetNames = (await readdirImpl(assetsDirectory))
    .filter((name) => typeof name === 'string' && name.endsWith('.js'))
    .sort()
  if (assetNames.length === 0) {
    throw new Error(
      'Endpoint performance production artifact has no JavaScript assets'
    )
  }

  const sources = []
  for (const name of assetNames) {
    sources.push(await readFileImpl(resolve(assetsDirectory, name), 'utf8'))
  }
  const artifactEndpoints = [
    ...new Set(
      sources.flatMap((source) =>
        typeof source === 'string'
          ? [...source.matchAll(collaborationEndpointPattern)].map(
              ([endpoint]) => endpoint
            )
          : []
      )
    )
  ].sort()
  if (
    artifactEndpoints.length !== 1 ||
    artifactEndpoints[0] !== normalizedExpectedEndpoint
  ) {
    throw new Error(
      `Endpoint performance production artifact endpoint mismatch: found ${
        artifactEndpoints.join(', ') || 'none'
      }; expected ${normalizedExpectedEndpoint}`
    )
  }
  return {
    assetsInspected: assetNames.length,
    endpoint: normalizedExpectedEndpoint
  }
}

const normalizePreparedResponsePreviewAttestation = (attestation) => {
  if (
    !attestation ||
    typeof attestation !== 'object' ||
    Array.isArray(attestation)
  ) {
    throw new TypeError(
      'Prepared response preview attestation must be an object'
    )
  }
  const { currentPath, manifestPath, productionIndexSha256 } = attestation
  if (!isNonEmptyBoundedString(currentPath) || !isAbsolute(currentPath)) {
    throw new TypeError(
      'Prepared response preview attestation requires one bounded absolute output path'
    )
  }
  if (!isNonEmptyBoundedString(manifestPath) || !isAbsolute(manifestPath)) {
    throw new TypeError(
      'Prepared response preview attestation requires one bounded absolute manifest path'
    )
  }
  const relativeManifestPath = relative(currentPath, manifestPath)
  if (
    relativeManifestPath.length === 0 ||
    relativeManifestPath === '..' ||
    relativeManifestPath.startsWith('../') ||
    isAbsolute(relativeManifestPath)
  ) {
    throw new TypeError(
      'Prepared response preview manifest must belong to the attested output directory'
    )
  }
  if (
    typeof productionIndexSha256 !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(productionIndexSha256)
  ) {
    throw new TypeError(
      'Prepared response preview attestation requires one SHA-256 production index digest'
    )
  }
  return {
    currentPath,
    manifestPath,
    productionIndexSha256
  }
}

const attestPreparedResponsePreview = async () => {
  const { attestPreparedServerResponsePreview } = await import(
    './prepared-server-response-artifacts.mjs'
  )
  return attestPreparedServerResponsePreview()
}

export const recordTrackedProcessGroupRegistration = (
  state,
  registration,
  { expectedToken, expectedOwner, rootPgid, descendantVerified = false }
) => {
  const reject = (reason) => ({ accepted: false, reason, state })
  if (
    !registration ||
    typeof registration !== 'object' ||
    Array.isArray(registration)
  ) {
    return reject('invalid-registration')
  }
  if (
    typeof expectedToken !== 'string' ||
    expectedToken.length === 0 ||
    registration.token !== expectedToken
  ) {
    return reject('invalid-token')
  }
  if (
    !isNonEmptyBoundedString(registration.owner) ||
    registration.owner !== expectedOwner
  ) {
    return reject('invalid-owner')
  }
  if (state.stopDecision) {
    return reject('guard-stopping')
  }
  if (
    !TRACKED_PROCESS_ROLE_SET.has(registration.role) ||
    !Number.isSafeInteger(registration.pid) ||
    registration.pid <= 0 ||
    registration.pid !== registration.pgid
  ) {
    return reject('invalid-process-group')
  }
  const isRootRegistration =
    registration.role === 'test-harness' &&
    registration.pid === rootPgid &&
    registration.pgid === rootPgid
  if (!isRootRegistration && !descendantVerified) {
    return reject('unverified-descendant')
  }
  if (registration.role === 'test-harness' && !isRootRegistration) {
    return reject('invalid-process-group')
  }

  const processGroups = sanitizeTrackedProcessGroups(state.processGroups)
  const sameRole = processGroups.find(({ role }) => role === registration.role)
  if (sameRole) {
    return sameRole.pgid === registration.pgid
      ? { accepted: true, reason: null, state }
      : reject('role-conflict')
  }
  if (processGroups.some(({ pgid }) => pgid === registration.pgid)) {
    return reject('process-group-conflict')
  }
  if (processGroups.length >= TRACKED_PROCESS_ROLES.length) {
    return reject('process-group-limit')
  }

  return {
    accepted: true,
    reason: null,
    state: {
      ...state,
      ...(!state.ready
        ? {
            acceptedRawSamples: 0,
            lastProcessSampleMonotonicMs: null,
            previousProcessSnapshot: null,
            sampledProcessRoles: []
          }
        : {}),
      processGroups: sanitizeTrackedProcessGroups([
        ...processGroups,
        { pgid: registration.pgid, role: registration.role }
      ])
    }
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

const isInactiveActor = (actor) =>
  actor.complete === false &&
  actor.canonicalElements === 0 &&
  actor.elements === 0 &&
  actor.renderProjectionElements === 0 &&
  actor.total === 0

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
  if (!PROOF_KINDS.has(heartbeat.proofKind)) {
    return 'invalid-proof-kind'
  }
  if (
    !isFiniteNonNegativeNumber(heartbeat.capturedAtMs) ||
    !(
      heartbeat.activePhase === null ||
      isNonEmptyBoundedString(heartbeat.activePhase)
    )
  ) {
    return 'invalid-phase-timing'
  }
  if (!validateActor(heartbeat.actorA) || !validateActor(heartbeat.actorB)) {
    return 'invalid-actor-progress'
  }
  if (
    heartbeat.proofKind === 'local-attribution' &&
    !isInactiveActor(heartbeat.actorB)
  ) {
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
    acceptedRawSamples: 0,
    lastHeartbeatAtMs: null,
    lastProgressAtMs: nowMs,
    lastHeartbeat: null,
    failure: null,
    endpointReport: null,
    processGroups: [],
    sampledProcessRoles: [],
    heartbeatSamples: [],
    cpuSafetySamples: [],
    maximumFrontendCpuSafetySample: null,
    maximumFrontendBootstrapCpuSafetySample: null,
    overallCpuLimitViolationSample: null,
    lastProcessSampleMonotonicMs: null,
    previousProcessSnapshot: null,
    attributionInvalidReason: null,
    activePhaseBoundary: null,
    phaseCpuTimeSamples: [],
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
  const config = state.config ?? mergeConfig()
  if (body.heartbeat.proofKind !== config.requiredProofKind) {
    return { accepted: false, reason: 'unexpected-proof-kind', state }
  }
  if (body.kind === 'ready' && state.acceptedRawSamples < 1) {
    return { accepted: false, reason: 'guard-not-armed', state }
  }
  if (
    body.kind === 'ready' &&
    config.requiredProcessRoles.some(
      (role) =>
        !state.processGroups.some((processGroup) => processGroup.role === role)
    )
  ) {
    return {
      accepted: false,
      reason: 'process-groups-not-ready',
      state
    }
  }
  if (
    body.kind === 'ready' &&
    config.requiredProcessRoles.some(
      (role) => !state.sampledProcessRoles.includes(role)
    )
  ) {
    return {
      accepted: false,
      reason: 'process-groups-not-sampled',
      state
    }
  }
  if (
    !state.ready &&
    body.kind !== 'ready' &&
    body.kind !== 'progress' &&
    body.kind !== 'failed'
  ) {
    return { accepted: false, reason: 'guard-not-ready', state }
  }

  const heartbeat = sanitizeHeartbeat(body.heartbeat)
  if (
    body.kind === 'complete' &&
    (heartbeat.proofKind === 'local-attribution'
      ? !isActorExactlyComplete(heartbeat.actorA) ||
        !isInactiveActor(heartbeat.actorB)
      : !isActorExactlyComplete(heartbeat.actorA) ||
        !isActorExactlyComplete(heartbeat.actorB))
  ) {
    return { accepted: false, reason: 'incomplete-proof', state }
  }
  const endpointReport =
    body.kind === 'complete'
      ? sanitizeEndpointReport(
          body.heartbeat.report,
          expectedOwner,
          heartbeat.proofKind
        )
      : state.endpointReport
  if (body.kind === 'complete' && endpointReport === null) {
    return { accepted: false, reason: 'invalid-endpoint-report', state }
  }
  const previous = state.lastHeartbeat
  const madeProgress =
    !previous ||
    heartbeat.actorA.elements > previous.actorA.elements ||
    heartbeat.actorB.elements > previous.actorB.elements
  const heartbeatSample = {
    kind: body.kind,
    receivedAtMs: nowMs,
    phase: heartbeat.phase,
    actorAElements: heartbeat.actorA.elements,
    actorBElements: heartbeat.actorB.elements
  }
  const failure =
    body.kind === 'failed'
      ? sanitizeFailure(body.heartbeat.error)
      : state.failure

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
      failure,
      endpointReport,
      heartbeatSamples: keepLast(
        [...state.heartbeatSamples, heartbeatSample],
        config.historyLimit
      )
    }
  }
}

const roundCpuMetric = (value) => Math.round(value * 1_000) / 1_000

const rendererPerformanceMetricNames = Object.freeze([
  'Timestamp',
  'TaskDuration',
  'ScriptDuration',
  'LayoutDuration',
  'RecalcStyleDuration',
  'JSHeapUsedSize'
])

const readRendererPerformanceMetricMap = (response) => {
  if (
    !response ||
    typeof response !== 'object' ||
    Array.isArray(response) ||
    !Array.isArray(response.metrics)
  ) {
    throw new TypeError('Renderer performance response must contain metrics')
  }
  const metrics = new Map()
  for (const metric of response.metrics) {
    if (
      metric &&
      typeof metric === 'object' &&
      !Array.isArray(metric) &&
      typeof metric.name === 'string' &&
      Number.isFinite(metric.value)
    ) {
      metrics.set(metric.name, metric.value)
    }
  }
  for (const name of rendererPerformanceMetricNames) {
    if (!metrics.has(name)) {
      throw new Error(`Renderer performance metric ${name} is unavailable`)
    }
  }
  return metrics
}

export const summarizeRendererPerformanceWindow = (
  startResponse,
  endResponse
) => {
  const start = readRendererPerformanceMetricMap(startResponse)
  const end = readRendererPerformanceMetricMap(endResponse)
  const durationMs = (end.get('Timestamp') - start.get('Timestamp')) * 1_000
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Renderer performance window duration must be positive')
  }
  const durationDeltaMs = (name) => {
    const value = (end.get(name) - start.get(name)) * 1_000
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Renderer performance metric ${name} moved backwards`)
    }
    return roundCpuMetric(value)
  }
  const taskDurationMs = durationDeltaMs('TaskDuration')
  return {
    averageTaskCorePercent: roundCpuMetric((taskDurationMs / durationMs) * 100),
    durationMs: roundCpuMetric(durationMs),
    heapUsedEndBytes: Math.round(end.get('JSHeapUsedSize')),
    heapUsedStartBytes: Math.round(start.get('JSHeapUsedSize')),
    layoutDurationMs: durationDeltaMs('LayoutDuration'),
    recalcStyleDurationMs: durationDeltaMs('RecalcStyleDuration'),
    scriptDurationMs: durationDeltaMs('ScriptDuration'),
    taskDurationMs
  }
}

const sanitizeProcessCpuSnapshot = (sample) => {
  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
    return null
  }
  const processCpuTimes = sanitizeProcessCpuTimes(sample.processCpuTimes)
  const monotonicMs = sample.monotonicMs ?? sample.nowMs
  if (
    processCpuTimes.length === 0 ||
    processCpuTimes.length !== sample.processCpuTimes?.length ||
    !isFiniteNonNegativeNumber(sample.nowMs) ||
    !isFiniteNonNegativeNumber(monotonicMs)
  ) {
    return null
  }
  return {
    monotonicMs,
    nowMs: sample.nowMs,
    processCpuTimes
  }
}

const processIdentityMatches = (left, right) =>
  left.pid === right.pid &&
  left.role === right.role &&
  (left.browserProcessType ?? null) === (right.browserProcessType ?? null)

const haveExactProcessIdentitySet = (leftEntries, rightEntries) => {
  if (leftEntries.length !== rightEntries.length) return false
  const leftByPid = new Map(leftEntries.map((entry) => [entry.pid, entry]))
  return rightEntries.every((entry) => {
    const left = leftByPid.get(entry.pid)
    return left && processIdentityMatches(left, entry)
  })
}

export const deriveProcessCpuTimeDelta = (previousSample, currentSample) => {
  const previous = sanitizeProcessCpuSnapshot(previousSample)
  const current = sanitizeProcessCpuSnapshot(currentSample)
  if (!previous || !current) {
    return { accepted: false, reason: 'invalid-process-sample', sample: null }
  }
  if (
    !haveExactProcessIdentitySet(
      previous.processCpuTimes,
      current.processCpuTimes
    )
  ) {
    return {
      accepted: false,
      reason: 'process-identity-changed',
      sample: null
    }
  }
  const previousByPid = new Map(
    previous.processCpuTimes.map((entry) => [entry.pid, entry])
  )
  const wallTimeMs = current.monotonicMs - previous.monotonicMs
  if (wallTimeMs <= 0) {
    return { accepted: false, reason: 'invalid-cpu-time-delta', sample: null }
  }

  const roleCpuTimeMs = createEmptyRoleCpuTimeMs()
  const browserProcessTypeCpuTimeMs = createEmptyBrowserProcessTypeCpuTimeMs()
  const rendererProcessCpuTimeMs = []
  let cpuTimeMs = 0
  for (const currentEntry of current.processCpuTimes) {
    const previousEntry = previousByPid.get(currentEntry.pid)
    const delta = currentEntry.cpuTimeMs - previousEntry.cpuTimeMs
    if (delta < 0) {
      return {
        accepted: false,
        reason: 'invalid-cpu-time-delta',
        sample: null
      }
    }
    cpuTimeMs += delta
    roleCpuTimeMs[roleCpuKey(currentEntry.role)] += delta
    if (currentEntry.role === 'client-browser') {
      browserProcessTypeCpuTimeMs[
        browserProcessTypeCpuKey(currentEntry.browserProcessType)
      ] += delta
      if (currentEntry.browserProcessType === 'renderer-or-worker') {
        rendererProcessCpuTimeMs.push({
          cpuTimeMs: delta,
          pid: currentEntry.pid,
          targetAttribution: 'unattributed-page-or-worker'
        })
      }
    }
  }

  return {
    accepted: true,
    reason: null,
    sample: {
      browserProcessTypeCpuTimeMs,
      cpuTimeMs,
      endedAtMs: current.nowMs,
      rendererProcessCpuTimeMs,
      roleCpuTimeMs,
      startedAtMs: previous.nowMs,
      wallTimeMs
    }
  }
}

export const recordResourcePhaseBoundary = (
  state,
  body,
  { expectedToken, expectedOwner }
) => {
  const reject = (reason) => ({ accepted: false, reason, state })
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject('invalid-body')
  }
  if (
    typeof expectedToken !== 'string' ||
    expectedToken.length === 0 ||
    body.token !== expectedToken
  ) {
    return reject('invalid-token')
  }
  if (!isNonEmptyBoundedString(body.owner) || body.owner !== expectedOwner) {
    return reject('invalid-owner')
  }
  if (
    !['start', 'end'].includes(body.kind) ||
    !isNonEmptyBoundedString(body.phase)
  ) {
    return reject('invalid-phase-boundary')
  }
  const sample = body.sample
  if (
    !sample ||
    typeof sample !== 'object' ||
    Array.isArray(sample) ||
    !isFiniteNonNegativeNumber(sample.cpuTimeMs) ||
    !isFiniteNonNegativeNumber(sample.nowMs)
  ) {
    return reject('invalid-process-sample')
  }
  const roleCpuTimeMs = sanitizeRoleCpuTimeMs(sample.roleCpuTimeMs)
  const processCpuTimes = sanitizeProcessCpuTimes(sample.processCpuTimes)
  const monotonicMs = sample.monotonicMs ?? sample.nowMs
  if (
    processCpuTimes.length === 0 ||
    processCpuTimes.length !== sample.processCpuTimes?.length ||
    !isFiniteNonNegativeNumber(monotonicMs)
  ) {
    return reject('invalid-process-sample')
  }
  if (body.kind === 'start') {
    if (state.activePhaseBoundary !== null) {
      return reject('phase-already-active')
    }
    return {
      accepted: true,
      reason: null,
      state: {
        ...state,
        activePhaseBoundary: {
          browserProcessTypeMaximumRawCpuPercent:
            createEmptyBrowserProcessTypeCpuPercent(),
          cpuTimeMs: sample.cpuTimeMs,
          maximumFrontendRawCpuPercent: 0,
          phase: body.phase,
          processCpuTimes,
          processSetChanged: false,
          rawSampleCount: 0,
          roleCpuTimeMs,
          startedAtMonotonicMs: monotonicMs,
          startedAtMs: sample.nowMs
        }
      }
    }
  }

  const active = state.activePhaseBoundary
  if (!active || active.phase !== body.phase) {
    return reject('phase-not-active')
  }
  if (active.processSetChanged) {
    return reject('phase-process-churn')
  }
  const wallTimeMs = monotonicMs - active.startedAtMonotonicMs
  if (wallTimeMs <= 0) {
    return reject('invalid-phase-delta')
  }
  const endingByPid = new Map(
    processCpuTimes.map((entry) => [entry.pid, entry])
  )
  for (const startedProcess of active.processCpuTimes) {
    if (!endingByPid.has(startedProcess.pid)) {
      return reject('phase-process-exited')
    }
  }
  if (processCpuTimes.length > active.processCpuTimes.length) {
    return reject('phase-process-created')
  }
  const startingByPid = new Map(
    active.processCpuTimes.map((entry) => [entry.pid, entry])
  )
  const roleCpuTimeDelta = createEmptyRoleCpuTimeMs()
  const browserProcessTypeCpuTimeDelta =
    createEmptyBrowserProcessTypeCpuTimeMs()
  let cpuTimeMs = 0
  for (const endingProcess of processCpuTimes) {
    const startingProcess = startingByPid.get(endingProcess.pid)
    if (
      startingProcess &&
      !processIdentityMatches(startingProcess, endingProcess)
    ) {
      return reject('invalid-phase-delta')
    }
    if (!startingProcess) {
      return reject('phase-process-created')
    }
    const delta = endingProcess.cpuTimeMs - startingProcess.cpuTimeMs
    if (delta < 0) {
      return reject('invalid-phase-delta')
    }
    cpuTimeMs += delta
    roleCpuTimeDelta[roleCpuKey(endingProcess.role)] += delta
    if (endingProcess.role === 'client-browser') {
      browserProcessTypeCpuTimeDelta[
        browserProcessTypeCpuKey(endingProcess.browserProcessType)
      ] += delta
    }
  }
  const phaseSample = {
    browserProcessTypeCpuTimeMs: browserProcessTypeCpuTimeDelta,
    browserProcessTypeMaximumRawCpuPercent:
      active.browserProcessTypeMaximumRawCpuPercent,
    cpuTimeMs,
    endedAtMs: sample.nowMs,
    maximumFrontendRawCpuPercent: active.maximumFrontendRawCpuPercent,
    phase: body.phase,
    rawSampleCount: active.rawSampleCount,
    roleCpuTimeMs: roleCpuTimeDelta,
    startedAtMs: active.startedAtMs,
    wallTimeMs
  }
  return {
    accepted: true,
    reason: null,
    state: {
      ...state,
      activePhaseBoundary: null,
      phaseCpuTimeSamples: keepLast(
        [...state.phaseCpuTimeSamples, phaseSample],
        state.config?.historyLimit ?? DEFAULT_RESOURCE_GUARD_CONFIG.historyLimit
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
  const currentProcessCpuSnapshot = sanitizeProcessCpuSnapshot(sample)
  if (!currentProcessCpuSnapshot) {
    const decision =
      state.stopDecision ?? stopDecision('invalid-process-sample', sample.nowMs)
    return {
      accepted: false,
      reason: 'invalid-process-sample',
      state: {
        ...state,
        attributionInvalidReason: 'invalid-process-sample',
        stopDecision: decision
      },
      decision
    }
  }
  if (state.finished) {
    return {
      accepted: true,
      reason: null,
      state: {
        ...state,
        acceptedProcessSamples: state.acceptedProcessSamples + 1,
        lastProcessSampleMonotonicMs: currentProcessCpuSnapshot.monotonicMs,
        previousProcessSnapshot: currentProcessCpuSnapshot
      },
      decision: state.stopDecision ?? noStopDecision
    }
  }
  const missingProcessRoles = normalizeRequiredProcessRoles(
    sample.missingProcessRoles
  )
  const missingRequiredProcessRoles =
    normalizedConfig.requiredProcessRoles.filter((role) =>
      missingProcessRoles.includes(role)
    )
  const sampledProcessRoles = normalizeRequiredProcessRoles(
    sample.trackedProcessRoles
  )
  const hasCompleteRequiredProcessSet =
    normalizedConfig.requiredProcessRoles.every((role) =>
      state.processGroups.some((processGroup) => processGroup.role === role)
    ) &&
    normalizedConfig.requiredProcessRoles.every((role) =>
      sampledProcessRoles.includes(role)
    ) &&
    missingRequiredProcessRoles.length === 0

  const previousProcessSnapshot = state.previousProcessSnapshot
  const processIdentityChanged =
    previousProcessSnapshot !== null &&
    !haveExactProcessIdentitySet(
      previousProcessSnapshot.processCpuTimes,
      currentProcessCpuSnapshot.processCpuTimes
    )
  const activePhaseProcessIdentityChanged =
    state.activePhaseBoundary !== null &&
    !haveExactProcessIdentitySet(
      state.activePhaseBoundary.processCpuTimes,
      currentProcessCpuSnapshot.processCpuTimes
    )
  const observedProcessIdentityChanged =
    processIdentityChanged || activePhaseProcessIdentityChanged
  const sampleGapExceeded =
    state.lastProcessSampleMonotonicMs !== null &&
    currentProcessCpuSnapshot.monotonicMs - state.lastProcessSampleMonotonicMs >
      normalizedConfig.maximumSampleGapMs
  let acceptedRawSamples = state.acceptedRawSamples
  if (!state.ready && observedProcessIdentityChanged) {
    acceptedRawSamples = hasCompleteRequiredProcessSet ? 1 : 0
  } else if (!state.ready && !hasCompleteRequiredProcessSet) {
    acceptedRawSamples = 0
  } else if (!observedProcessIdentityChanged && hasCompleteRequiredProcessSet) {
    acceptedRawSamples += 1
  }

  const heartbeatCapturedAtMs = state.lastHeartbeat?.capturedAtMs ?? null
  const roleRawCpuPercent = sanitizeRoleCpuPercent(sample.roleCpuPercent)
  const browserProcessTypeRawCpuPercent = sanitizeBrowserProcessTypeCpuPercent(
    sample.browserProcessTypeCpuPercent
  )
  const frontendRawCpuPercent = roundCpuMetric(roleRawCpuPercent.clientBrowser)
  const contributors = sanitizeCpuContributors(sample.contributors)
  const cpuSafetySample = {
    pgid: targetPgid,
    browserProcessTypeRawCpuPercent,
    contributors,
    frontendRawCpuPercent,
    guardPhase: state.ready
      ? (state.activePhaseBoundary?.phase ?? 'between-phases')
      : 'browser-bootstrap',
    heartbeatAgeMs:
      heartbeatCapturedAtMs === null
        ? null
        : Math.max(0, sample.nowMs - heartbeatCapturedAtMs),
    heartbeatCapturedAtMs,
    heartbeatPhase: state.lastHeartbeat?.phase ?? 'pre-heartbeat',
    rawCpuPercent: roundCpuMetric(sample.cpuPercent),
    rendererProcessRawCpuPercent: contributors
      .filter(
        ({ browserProcessType, role }) =>
          role === 'client-browser' &&
          browserProcessType === 'renderer-or-worker'
      )
      .map(({ cpuPercent, pid }) => ({ pid, rawCpuPercent: cpuPercent })),
    roleRawCpuPercent,
    ...(missingProcessRoles.length > 0 ? { missingProcessRoles } : {}),
    sampledAtMs: sample.nowMs
  }
  const cpuSafetySamples = keepLast(
    [...state.cpuSafetySamples, cpuSafetySample],
    normalizedConfig.historyLimit
  )
  const maximumFrontendCpuSafetySample =
    !state.maximumFrontendCpuSafetySample ||
    frontendRawCpuPercent >
      state.maximumFrontendCpuSafetySample.frontendRawCpuPercent
      ? cpuSafetySample
      : state.maximumFrontendCpuSafetySample
  const maximumFrontendBootstrapCpuSafetySample =
    !state.ready &&
    (!state.maximumFrontendBootstrapCpuSafetySample ||
      frontendRawCpuPercent >
        state.maximumFrontendBootstrapCpuSafetySample.frontendRawCpuPercent)
      ? cpuSafetySample
      : state.maximumFrontendBootstrapCpuSafetySample
  let decision = state.stopDecision
  if (!decision && !state.finished && missingRequiredProcessRoles.length > 0) {
    decision = stopDecision('tracked-process-group-missing', sample.nowMs)
  }
  if (
    !decision &&
    observedProcessIdentityChanged &&
    (state.ready || state.activePhaseBoundary)
  ) {
    decision = stopDecision('tracked-process-identity-changed', sample.nowMs)
  }
  if (!decision && sampleGapExceeded) {
    decision = stopDecision('cpu-sample-gap-exceeded', sample.nowMs)
  }
  if (!decision && sample.cpuPercent > normalizedConfig.maximumCpuPercent) {
    decision = stopDecision('cpu-limit-exceeded', sample.nowMs)
  }
  if (
    !decision &&
    frontendRawCpuPercent > normalizedConfig.maximumFrontendCpuPercent
  ) {
    decision = stopDecision('frontend-cpu-limit-exceeded', sample.nowMs)
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

  let activePhaseBoundary = state.activePhaseBoundary
  if (activePhaseBoundary) {
    if (observedProcessIdentityChanged) {
      activePhaseBoundary = {
        ...activePhaseBoundary,
        processSetChanged: true
      }
    } else {
      const browserProcessTypeMaximumRawCpuPercent = {
        ...activePhaseBoundary.browserProcessTypeMaximumRawCpuPercent
      }
      for (const key of Object.keys(browserProcessTypeMaximumRawCpuPercent)) {
        browserProcessTypeMaximumRawCpuPercent[key] = Math.max(
          browserProcessTypeMaximumRawCpuPercent[key],
          browserProcessTypeRawCpuPercent[key]
        )
      }
      activePhaseBoundary = {
        ...activePhaseBoundary,
        browserProcessTypeMaximumRawCpuPercent,
        maximumFrontendRawCpuPercent: Math.max(
          activePhaseBoundary.maximumFrontendRawCpuPercent,
          frontendRawCpuPercent
        ),
        rawSampleCount: activePhaseBoundary.rawSampleCount + 1
      }
    }
  }
  let attributionInvalidReason = state.attributionInvalidReason
  if (
    observedProcessIdentityChanged &&
    (state.ready || state.activePhaseBoundary)
  ) {
    attributionInvalidReason = 'tracked-process-identity-changed'
  } else if (sampleGapExceeded) {
    attributionInvalidReason = 'cpu-sample-gap-exceeded'
  }
  const overallCpuLimitViolationSample =
    state.overallCpuLimitViolationSample ??
    (decision?.reason === 'cpu-limit-exceeded' ? cpuSafetySample : null)
  const nextState = {
    ...state,
    activePhaseBoundary,
    attributionInvalidReason,
    config: normalizedConfig,
    acceptedProcessSamples: state.acceptedProcessSamples + 1,
    acceptedRawSamples,
    sampledProcessRoles,
    cpuSafetySamples,
    maximumFrontendCpuSafetySample,
    maximumFrontendBootstrapCpuSafetySample,
    overallCpuLimitViolationSample,
    lastProcessSampleMonotonicMs: currentProcessCpuSnapshot.monotonicMs,
    previousProcessSnapshot: currentProcessCpuSnapshot,
    stopDecision: decision
  }
  return {
    accepted: true,
    reason: null,
    state: nextState,
    decision: decision ?? noStopDecision
  }
}

export const recordGuardedResourcePhaseBoundary = (
  state,
  body,
  { expectedToken, expectedOwner, targetPgid, config }
) => {
  const evaluated = evaluateResourceSample(state, body?.sample, {
    targetPgid,
    config
  })
  if (!evaluated.accepted) {
    return evaluated
  }
  if (evaluated.decision.stop) {
    return {
      accepted: false,
      reason: evaluated.decision.reason,
      state: evaluated.state,
      decision: evaluated.decision
    }
  }
  if (body?.kind === 'start' && evaluated.state.ready !== true) {
    return {
      accepted: false,
      reason: 'guard-not-ready',
      state: evaluated.state,
      decision: evaluated.decision
    }
  }
  const boundary = recordResourcePhaseBoundary(evaluated.state, body, {
    expectedOwner,
    expectedToken
  })
  return {
    ...boundary,
    decision: evaluated.decision
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
    ownerEvidence: heartbeat?.ownerEvidence ?? null,
    heartbeats: keepLast(state.heartbeatSamples, historyLimit),
    cpuSafetySamples: keepLast(state.cpuSafetySamples, historyLimit),
    maximumFrontendCpuSafetySample: state.maximumFrontendCpuSafetySample,
    maximumFrontendBootstrapCpuSafetySample:
      state.maximumFrontendBootstrapCpuSafetySample,
    overallCpuLimitViolationSample: state.overallCpuLimitViolationSample,
    acceptedRawSamples: state.acceptedRawSamples,
    attributionInvalidReason: state.attributionInvalidReason,
    activePhaseBoundary: state.activePhaseBoundary,
    phaseCpuTimeSamples: keepLast(state.phaseCpuTimeSamples, historyLimit),
    sampleFailure: state.sampleFailure,
    processGroups: sanitizeTrackedProcessGroups(state.processGroups),
    profileMetrics: state.profileMetrics,
    endpointReport: state.endpointReport,
    failure: state.failure,
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
  getProcessGroups = () => [{ pgid, role: 'test-harness' }],
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
    const groups = sanitizeTrackedProcessGroups(getProcessGroups())
    for (const group of groups) {
      try {
        emergencyKill(-group.pgid, 'SIGKILL')
      } catch (error) {
        if (!isMissingProcessError(error)) {
          // Exit hooks cannot recover or broaden their process target.
        }
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

export const terminateTrackedProcessGroups = async ({
  processGroups,
  graceMs,
  terminate = terminateTrackedProcessGroup,
  fallbackTerminate = terminateTrackedProcessGroup
}) => {
  const groups = sanitizeTrackedProcessGroups(processGroups)
  const rootGroup = groups.find(({ role }) => role === 'test-harness')
  if (!rootGroup) {
    throw new Error(
      'Tracked process termination requires the root harness group'
    )
  }
  const productGroups = PRODUCT_PROCESS_ROLES.flatMap((role) => {
    const group = groups.find((candidate) => candidate.role === role)
    return group ? [group] : []
  })
  const terminateGroup = async (group) => ({
    role: group.role,
    ...(await attemptGuardedTermination({
      pgid: group.pgid,
      graceMs,
      terminate,
      fallbackTerminate
    }))
  })
  const productResultsPromise = Promise.all(productGroups.map(terminateGroup))
  const rootResultPromise = terminateGroup(rootGroup)
  const [productResults, rootResult] = await Promise.all([
    productResultsPromise,
    rootResultPromise
  ])
  const results = [...productResults, rootResult]
  return {
    confirmed: results.every((result) => result.confirmed),
    groups: results
  }
}

const forceKillExactTrackedProcessGroups = ({
  processGroups,
  emergencyKill
}) => {
  const failures = []
  const groups = sanitizeTrackedProcessGroups(processGroups).map((group) => {
    try {
      emergencyKill(-group.pgid, 'SIGKILL')
      return { ...group, forceKilled: true }
    } catch (error) {
      if (isMissingProcessError(error)) {
        return { ...group, forceKilled: false }
      }
      failures.push({
        message: boundedErrorMessage(error),
        pgid: group.pgid,
        role: group.role
      })
      return { ...group, forceKilled: false }
    }
  })
  return {
    confirmed: failures.length === 0,
    failures,
    groups
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

const parseTrackedProcessLauncherArguments = (argv, baseEnv = process.env) => {
  const environmentRole = baseEnv.ASYRA_DESIGN_TRACKED_ROLE?.trim()
  const environmentExecutable = baseEnv.ASYRA_DESIGN_TRACKED_EXECUTABLE?.trim()
  if (environmentRole || environmentExecutable) {
    if (
      !PRODUCT_PROCESS_ROLES.includes(environmentRole) ||
      !isNonEmptyBoundedString(environmentExecutable)
    ) {
      throw new Error(
        'Tracked browser launcher requires a fixed role and executable'
      )
    }
    return {
      role: environmentRole,
      command: environmentExecutable,
      args: [...argv]
    }
  }

  if (
    argv.length < 5 ||
    argv[0] !== '--tracked-role' ||
    !PRODUCT_PROCESS_ROLES.includes(argv[1]) ||
    argv[2] !== '--'
  ) {
    throw new Error(
      'Tracked process launcher usage: --tracked-role <role> -- <command>'
    )
  }
  return {
    role: argv[1],
    command: argv[3],
    args: argv.slice(4)
  }
}

const postTrackedProcessRegistration = async (
  registration,
  { guardUrl, timeoutMs = 3_000, fetchImpl = globalThis.fetch }
) => {
  const response = await fetchImpl(
    `${guardUrl.replace(/\/+$/u, '')}${TRACKED_PROCESS_REGISTRATION_PATH}`,
    {
      body: JSON.stringify(registration),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: globalThis.AbortSignal.timeout(timeoutMs)
    }
  )
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.accepted !== true) {
    throw new Error(
      `Tracked ${registration.role} process group registration failed: ${
        result.reason ?? response.status
      }`
    )
  }
}

export const runTrackedProcessLauncher = async (
  argv,
  {
    baseEnv = process.env,
    fetchImpl = globalThis.fetch,
    spawnImpl = spawn,
    runtimeProcess = process
  } = {}
) => {
  const parsed = parseTrackedProcessLauncherArguments(argv, baseEnv)
  const guardUrl = baseEnv.ASYRA_DESIGN_ENDPOINT_GUARD_URL?.trim()
  const guardToken = baseEnv.ASYRA_DESIGN_ENDPOINT_GUARD_TOKEN?.trim()
  const owner = baseEnv.ASYRA_DESIGN_ENDPOINT_OWNER?.trim()
  if (
    !isNonEmptyBoundedString(guardUrl) ||
    !isNonEmptyBoundedString(guardToken) ||
    !isNonEmptyBoundedString(owner)
  ) {
    throw new Error('Tracked process launcher requires the active guard')
  }

  await postTrackedProcessRegistration(
    {
      owner,
      pgid: runtimeProcess.pid,
      pid: runtimeProcess.pid,
      role: parsed.role,
      token: guardToken
    },
    { fetchImpl, guardUrl }
  )

  const childEnvironment = { ...baseEnv }
  GUARD_ENVIRONMENT_KEYS.forEach((key) => {
    Reflect.deleteProperty(childEnvironment, key)
  })
  const child = spawnImpl(parsed.command, parsed.args, {
    detached: false,
    env: childEnvironment,
    shell: false,
    stdio:
      parsed.role === 'client-browser'
        ? ['ignore', 'inherit', 'inherit', 3, 4]
        : 'inherit'
  })
  return await new Promise((resolveChild, rejectChild) => {
    child.once('error', rejectChild)
    child.once('close', (code, signal) => {
      resolveChild({
        exitCode: Number.isInteger(code) ? code : 1,
        signal: typeof signal === 'string' ? signal : null
      })
    })
  })
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
  const attributionCase =
    baseEnv.ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE?.trim() ?? ''
  const validAttributionCases = new Set([
    '16',
    '16-reduced-motion',
    '1280',
    '16-two-actor-activity',
    '1280-two-actor-attribution',
    '320-two-actor-attribution'
  ])
  if (attributionCase && !validAttributionCases.has(attributionCase)) {
    throw new Error(
      'ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE must be 16, 16-reduced-motion, 1280, 16-two-actor-activity, 1280-two-actor-attribution, or 320-two-actor-attribution'
    )
  }
  const twoActorActivityAttribution = [
    '16-two-actor-activity',
    '1280-two-actor-attribution',
    '320-two-actor-attribution'
  ].includes(attributionCase)
  const singleActorAttribution =
    attributionCase.length > 0 && !twoActorActivityAttribution
  let selectedPlaywrightTest = 'creation-only high-detail endpoint proof'
  let requiredProofKind = 'endpoint'
  if (singleActorAttribution) {
    selectedPlaywrightTest = 'single-Actor local attribution'
    requiredProofKind = 'local-attribution'
  } else if (twoActorActivityAttribution) {
    selectedPlaywrightTest = 'two-Actor operation and idle attribution'
    requiredProofKind = 'collaboration-attribution'
  }
  const sharedEnv = {
    ...baseEnv,
    ASYRA_DESIGN_ENDPOINT_APP_PORT: String(appPort),
    ASYRA_DESIGN_ENDPOINT_COLLABORATION_PORT: String(collaborationPort),
    ASYRA_DESIGN_ENDPOINT_CONNECTIVITY_ONLY: '0',
    ASYRA_DESIGN_APP_URL: `http://127.0.0.1:${appPort}`,
    ASYRA_DESIGN_COLLABORATION_WS_PORT: String(collaborationPort),
    ASYRA_DESIGN_E2E_OWN_SERVERS: '1',
    ASYRA_DESIGN_COLLABORATION_PROFILE: '1',
    ASYRA_DESIGN_ENDPOINT_ATTRIBUTION_CASE: attributionCase,
    VITE_ASYRA_DESIGN_COLLABORATION_WS_URL: collaborationUrl
  }
  return [
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
        '--workers=1',
        '--grep',
        selectedPlaywrightTest
      ],
      baseEnv: sharedEnv,
      guardConfig: {
        guardMode: 'proof',
        maximumCpuPercent: DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent,
        maximumFrontendCpuPercent:
          requiredProofKind === 'endpoint'
            ? DEFAULT_RESOURCE_GUARD_CONFIG.maximumCpuPercent
            : DEFAULT_RESOURCE_GUARD_CONFIG.maximumFrontendCpuPercent,
        requiredProofKind,
        requiredProcessRoles: [...TRACKED_PROCESS_ROLES]
      },
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

export const sampleTrackedProcessGroupsCpu = async (
  rootPgid,
  {
    processGroups,
    execFileImpl = execFile,
    nowMs,
    now = Date.now,
    monotonicMs,
    monotonicNow = () => Number(process.hrtime.bigint()) / 1_000_000,
    platform = process.platform
  } = {}
) => {
  if (!Number.isSafeInteger(rootPgid) || rootPgid <= 0) {
    throw new TypeError('A positive root process-group ID is required')
  }
  const groups = sanitizeTrackedProcessGroups(processGroups)
  if (
    !groups.some(
      ({ pgid, role }) => pgid === rootPgid && role === 'test-harness'
    )
  ) {
    throw new Error('Tracked process groups are missing the root harness group')
  }
  const groupByPgid = new Map(groups.map((group) => [group.pgid, group]))
  const processGroupList = groups.map(({ pgid }) => pgid).join(',')
  const processArguments =
    platform === 'darwin'
      ? ['-g', processGroupList, '-o', 'pid=,ppid=,pgid=,%cpu=,time=,command=']
      : ['-Ao', 'pid=,ppid=,pgid=,%cpu=,time=,command=']
  const stdout = await execFilePromise(execFileImpl, 'ps', processArguments, {
    encoding: 'utf8',
    killSignal: 'SIGKILL',
    timeout: DEFAULT_RESOURCE_GUARD_CONFIG.sampleTimeoutMs,
    maxBuffer: 256 * 1024
  })
  const roleCpuPercent = createEmptyRoleCpuPercent()
  const roleCpuTimeMs = createEmptyRoleCpuTimeMs()
  const browserProcessTypeCpuPercent = createEmptyBrowserProcessTypeCpuPercent()
  const browserProcessTypeCpuTimeMs = createEmptyBrowserProcessTypeCpuTimeMs()
  const contributors = []
  const processCpuTimes = []
  const sampledPgids = new Set()
  let cpuPercent = 0
  let cpuTimeMs = 0
  for (const line of stdout.split(/\r?\n/u)) {
    const match = line
      .trim()
      .match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\S+)(?:\s+(.*))?$/u)
    if (!match) continue
    const pgid = Number(match[3])
    const group = groupByPgid.get(pgid)
    if (!group) continue
    sampledPgids.add(pgid)
    const processCpuPercent = Number(match[4])
    const processCpuTimeMs = parseCpuTimeToMilliseconds(match[5])
    const command = match[6]?.trim() ?? ''
    const classification =
      command.length > 0 ? classifyProcessCommand(command) : null
    const browserProcessType =
      group.role === 'client-browser'
        ? (classification?.browserProcessType ?? 'other-browser')
        : null
    cpuPercent += processCpuPercent
    cpuTimeMs += processCpuTimeMs
    const roleKey = roleCpuKey(group.role)
    roleCpuPercent[roleKey] += processCpuPercent
    roleCpuTimeMs[roleKey] += processCpuTimeMs
    if (browserProcessType) {
      const browserProcessTypeKey = browserProcessTypeCpuKey(browserProcessType)
      browserProcessTypeCpuPercent[browserProcessTypeKey] += processCpuPercent
      browserProcessTypeCpuTimeMs[browserProcessTypeKey] += processCpuTimeMs
    }
    processCpuTimes.push({
      ...(browserProcessType ? { browserProcessType } : {}),
      cpuTimeMs: processCpuTimeMs,
      pid: Number(match[1]),
      role: group.role
    })
    if (classification) {
      contributors.push({
        ...(browserProcessType ? { browserProcessType } : {}),
        cpuPercent: processCpuPercent,
        executable: classification.executable,
        parentPid: Number(match[2]),
        pgid,
        pid: Number(match[1]),
        role: group.role
      })
    }
  }
  const trackedProcessRoles = TRACKED_PROCESS_ROLES.filter((role) =>
    groups.some((group) => group.role === role && sampledPgids.has(group.pgid))
  )
  const missingProcessRoles = TRACKED_PROCESS_ROLES.filter((role) =>
    groups.some((group) => group.role === role && !sampledPgids.has(group.pgid))
  )
  if (processCpuTimes.length > MAX_PROCESS_CPU_TIME_ENTRIES) {
    throw new Error(
      `Tracked process sample exceeded ${MAX_PROCESS_CPU_TIME_ENTRIES} entries`
    )
  }
  return {
    browserProcessTypeCpuPercent,
    browserProcessTypeCpuTimeMs,
    pgid: rootPgid,
    cpuTimeMs,
    cpuPercent,
    contributors: sanitizeCpuContributors(contributors),
    missingProcessRoles,
    monotonicMs: monotonicMs ?? monotonicNow(),
    nowMs: nowMs ?? now(),
    processCpuTimes: sanitizeProcessCpuTimes(processCpuTimes),
    roleCpuPercent,
    roleCpuTimeMs,
    trackedProcessRoles
  }
}

const readTrackedProcessIdentity = async (
  pid,
  { execFileImpl = execFile } = {}
) => {
  const stdout = await execFilePromise(
    execFileImpl,
    'ps',
    ['-p', String(pid), '-o', 'pid=,ppid=,pgid='],
    {
      encoding: 'utf8',
      killSignal: 'SIGKILL',
      timeout: DEFAULT_RESOURCE_GUARD_CONFIG.sampleTimeoutMs,
      maxBuffer: 4 * 1024
    }
  )
  const match = stdout.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/u)
  if (!match) return null
  return {
    pid: Number(match[1]),
    parentPid: Number(match[2]),
    pgid: Number(match[3])
  }
}

export const verifyTrackedProcessDescendant = async (
  { pid, pgid, rootPgid },
  { readIdentity = readTrackedProcessIdentity } = {}
) => {
  if (
    !Number.isSafeInteger(pid) ||
    pid <= 0 ||
    pid !== pgid ||
    !Number.isSafeInteger(rootPgid) ||
    rootPgid <= 0
  ) {
    return false
  }
  let currentPid = pid
  for (let depth = 0; depth < 32; depth += 1) {
    const identity = await readIdentity(currentPid)
    if (!identity || identity.pid !== currentPid) return false
    if (depth === 0 && identity.pgid !== pgid) return false
    if (identity.pid === rootPgid) return true
    if (
      !Number.isSafeInteger(identity.parentPid) ||
      identity.parentPid <= 1 ||
      identity.parentPid === identity.pid
    ) {
      return false
    }
    currentPid = identity.parentPid
  }
  return false
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

export const createSerializedResourceSampler = (sampleSnapshot) => {
  if (typeof sampleSnapshot !== 'function') {
    throw new TypeError('A resource sample function is required')
  }
  let operationTail = Promise.resolve()
  return (consumeSample) => {
    if (typeof consumeSample !== 'function') {
      return Promise.reject(
        new TypeError('A resource sample consumer is required')
      )
    }
    const operation = operationTail.then(async () => {
      const sample = await sampleSnapshot()
      return consumeSample(sample)
    })
    operationTail = operation.then(
      () => undefined,
      () => undefined
    )
    return operation
  }
}

export const runResourceGuardCli = async (
  argv,
  {
    spawnImpl = spawn,
    sampleCpu = sampleTrackedProcessGroupsCpu,
    terminate = terminateTrackedProcessGroup,
    fallbackTerminate = terminateTrackedProcessGroup,
    verifyDescendant = verifyTrackedProcessDescendant,
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
  const exactEmergencyKill =
    emergencyKill ?? ((pid, signal) => process.kill(pid, signal))
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
  let targetPgid = null
  let requestTermination = () => undefined
  const runSerializedSample = createSerializedResourceSampler(async () => {
    if (!Number.isSafeInteger(targetPgid) || targetPgid <= 0) {
      throw new Error('Resource guard process group is not ready')
    }
    return sampleCpu(targetPgid, {
      processGroups: state.processGroups
    })
  })

  const server = createHttpServer(async (request, response) => {
    if (
      request.method !== 'POST' ||
      ![
        '/heartbeat',
        PHASE_BOUNDARY_PATH,
        TRACKED_PROCESS_REGISTRATION_PATH
      ].includes(request.url)
    ) {
      sendJson(response, 404, { accepted: false })
      return
    }
    try {
      const body = await readBoundedJsonBody(
        request,
        normalizedConfig.requestBodyLimitBytes
      )
      if (request.url === TRACKED_PROCESS_REGISTRATION_PATH) {
        let result = recordTrackedProcessGroupRegistration(state, body, {
          descendantVerified: false,
          expectedOwner: parsed.owner,
          expectedToken: token,
          rootPgid: targetPgid
        })
        if (
          result.reason === 'unverified-descendant' &&
          Number.isSafeInteger(targetPgid)
        ) {
          const descendantVerified = await verifyDescendant({
            pid: body.pid,
            pgid: body.pgid,
            rootPgid: targetPgid
          })
          result = recordTrackedProcessGroupRegistration(state, body, {
            descendantVerified,
            expectedOwner: parsed.owner,
            expectedToken: token,
            rootPgid: targetPgid
          })
        }
        state = result.state
        let statusCode = 400
        if (result.accepted) {
          statusCode = 200
        } else if (result.reason === 'invalid-token') {
          statusCode = 401
        }
        sendJson(response, statusCode, {
          accepted: result.accepted,
          ...(result.reason ? { reason: result.reason } : {})
        })
        return
      }
      if (request.url === PHASE_BOUNDARY_PATH) {
        if (body.token !== token) {
          sendJson(response, 401, {
            accepted: false,
            reason: 'invalid-token'
          })
          return
        }
        if (
          body.owner !== parsed.owner ||
          !['start', 'end'].includes(body.kind) ||
          !isNonEmptyBoundedString(body.phase) ||
          !Number.isSafeInteger(targetPgid)
        ) {
          sendJson(response, 400, {
            accepted: false,
            reason: 'invalid-phase-boundary'
          })
          return
        }
        let result
        try {
          result = await runSerializedSample((sample) => {
            const nextResult = recordGuardedResourcePhaseBoundary(
              state,
              {
                ...body,
                sample
              },
              {
                expectedOwner: parsed.owner,
                expectedToken: token,
                targetPgid
              }
            )
            state = nextResult.state
            return nextResult
          })
        } catch (error) {
          const failure = recordResourceSampleFailure(state, {
            targetPgid,
            nowMs: now(),
            error
          })
          state = failure.state
          sendJson(response, 503, {
            accepted: false,
            reason: 'resource-sample-failed'
          })
          void requestTermination('phase-boundary-sample-failed')
          return
        }
        sendJson(response, result.accepted ? 200 : 409, {
          accepted: result.accepted,
          ...(result.reason ? { reason: result.reason } : {})
        })
        if (result.decision?.stop) {
          void requestTermination('phase-boundary-safety')
        }
        return
      }
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

  targetPgid = child.pid
  const rootRegistration = recordTrackedProcessGroupRegistration(
    state,
    {
      owner: parsed.owner,
      pgid: targetPgid,
      pid: targetPgid,
      role: 'test-harness',
      token
    },
    {
      descendantVerified: true,
      expectedOwner: parsed.owner,
      expectedToken: token,
      rootPgid: targetPgid
    }
  )
  if (!rootRegistration.accepted) {
    await close(server)
    throw new Error('Resource guard could not register its root process group')
  }
  state = rootRegistration.state
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
  const markCleanupFailure = () => {
    if (state.stopDecision) return
    state = {
      ...state,
      stopDecision: stopDecision('tracked-process-cleanup-failed', now())
    }
  }
  const startCleanup = () => {
    if (terminationPromise) {
      return terminationPromise
    }
    terminationPromise = terminateTrackedProcessGroups({
      processGroups: state.processGroups,
      graceMs: normalizedConfig.terminationGraceMs,
      terminate,
      fallbackTerminate
    })
      .then((result) => {
        if (result.confirmed) {
          termination = result
          return result
        }
        markCleanupFailure()
        termination = {
          ...result,
          emergency: forceKillExactTrackedProcessGroups({
            processGroups: state.processGroups,
            emergencyKill: exactEmergencyKill
          })
        }
        return termination
      })
      .catch((error) => {
        markCleanupFailure()
        termination = {
          confirmed: false,
          emergency: forceKillExactTrackedProcessGroups({
            processGroups: state.processGroups,
            emergencyKill: exactEmergencyKill
          }),
          failures: [{ message: boundedErrorMessage(error) }],
          groups: []
        }
        return termination
      })
    return terminationPromise
  }
  const startTermination = (reason = 'guard-requested') => {
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
    resolveTerminationStarted()
    return startCleanup()
  }
  requestTermination = startTermination
  const removeLifecycleGuard = installTrackedProcessLifecycleGuard({
    pgid: targetPgid,
    getProcessGroups: () => state.processGroups,
    startTermination,
    runtimeProcess,
    emergencyKill: exactEmergencyKill
  })
  const sampleTrackedGroup = async () => {
    if (childClosed || evaluationRunning || terminationStarted) {
      return
    }
    evaluationRunning = true
    try {
      const result = await runSerializedSample((sample) => {
        if (childClosed) {
          return null
        }
        const nextResult = evaluateResourceSample(state, sample, {
          targetPgid,
          config: normalizedConfig
        })
        state = nextResult.state
        return nextResult
      })
      if (result?.decision.stop) {
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
      const cleanup = await startCleanup()
      if (
        !state.stopDecision &&
        cleanup.groups.some(
          ({ forceKilled, termSent }) => forceKilled || termSent
        )
      ) {
        state = {
          ...state,
          stopDecision: stopDecision(
            'tracked-process-leaked-after-child-close',
            now()
          )
        }
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
          Math.min(1_000, normalizedConfig.terminationGraceMs)
        )
        childClose.then((result) => {
          clearTimeout(timeout)
          resolveExit(result)
        })
      })
      if (childExit.error === 'child-close-timeout') {
        termination = {
          ...termination,
          childCloseEmergency: forceKillExactTrackedProcessGroups({
            processGroups: state.processGroups,
            emergencyKill: exactEmergencyKill
          })
        }
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
  const assertAvailable =
    dependencies.assertPortAvailable ?? assertPortAvailable
  const attestBuild = dependencies.attestBuild ?? attestEndpointBuildArtifact
  const attestResponsePreview =
    dependencies.attestResponsePreview ?? attestPreparedResponsePreview
  const runPhase = dependencies.runPhase ?? runResourceGuardCli
  const phases = buildEndpointPerformancePhases({
    owner,
    baseEnv: dependencies.baseEnv ?? process.env
  })
  for (const port of phases[0].ports) {
    await assertAvailable(port)
  }

  const [runtimePhase] = phases
  const artifactAttestation = await attestBuild({
    expectedEndpoint:
      runtimePhase.baseEnv.VITE_ASYRA_DESIGN_COLLABORATION_WS_URL
  })
  const responsePreviewAttestation =
    normalizePreparedResponsePreviewAttestation(await attestResponsePreview())
  const result = await runPhase(runtimePhase.argv, {
    ...dependencies,
    baseEnv: {
      ...runtimePhase.baseEnv,
      [ENDPOINT_ARTIFACT_ENV]: artifactAttestation.endpoint,
      [ENDPOINT_PREVIEW_OUT_DIR_ENV]: responsePreviewAttestation.currentPath,
      [ENDPOINT_RESPONSE_ARTIFACT_ENV]:
        responsePreviewAttestation.productionIndexSha256,
      [ENDPOINT_RESPONSE_MANIFEST_PATH_ENV]:
        responsePreviewAttestation.manifestPath
    },
    config: runtimePhase.guardConfig,
    requiresReady: runtimePhase.requiresReady
  })
  return {
    exitCode: result.exitCode,
    phases: [
      {
        phase: runtimePhase.name,
        exitCode: result.exitCode,
        report: result.report
      }
    ]
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const argv = process.argv.slice(2)
  const trackedLauncher =
    argv[0] === '--tracked-role' ||
    Boolean(process.env.ASYRA_DESIGN_TRACKED_ROLE)
  let execution
  if (trackedLauncher) {
    execution = runTrackedProcessLauncher(argv)
  } else if (argv.includes('--')) {
    execution = runResourceGuardCli(argv)
  } else {
    execution = runEndpointPerformancePipeline(argv)
  }
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
