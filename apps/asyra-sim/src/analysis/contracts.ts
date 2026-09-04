import {
  validIdentifier,
  type Geometry,
  type Trajectory
} from '../domain/workcell'
import type {
  TrajectoryJointUnit,
  TrajectorySourceUnits
} from '../domain/trajectory-source'
import { hasExactOwnKeys, isPlainRecord } from '../domain/records'

export interface ExcludedBodyPair {
  version: 1
  a: string
  b: string
  reason: string
}

export interface ExperimentScope {
  primaryBodyIds: readonly string[]
  influencingBodyIds: readonly string[]
  selfCollision: boolean
  externalCollision: boolean
  excludedPairs: readonly ExcludedBodyPair[]
  acknowledgedExcludedVisibleBodyIds: readonly string[]
  backgroundNote: string
}

export interface ExperimentMethodSelection {
  id: string
  version: string
  settings: {
    distanceTolerance: number
    timeTolerance: number
    maxIterations: number
  }
}

export interface ExperimentRule {
  version: 1
  revision: number
  minimumClearance: number
}

export interface ExperimentBudget {
  maxIntervals: number
  maxDurationMs: number
}

/** App-wide admission ceilings; a method may declare stricter limits. */
export const EXPERIMENT_RESOURCE_PROFILE = Object.freeze({
  maxPairs: 4096,
  maxWorkUnits: 500000,
  warningPairs: 256,
  warningWorkUnits: 10000,
  maxIntervals: 1000000,
  minDurationMs: 100,
  maxDurationMs: 120000,
  maxEvidenceLeaves: 200000,
  maxEvidenceBytes: 64 * 1024 * 1024,
  terminationGraceMs: 250,
  progressIntervalMs: 100
})

export const DEFAULT_EXPERIMENT_BUDGET: Readonly<ExperimentBudget> =
  Object.freeze({
    maxIntervals: 100000,
    maxDurationMs: 30000
  })

export interface ExperimentDefinition {
  version: 1
  revision: number
  trajectory: Trajectory
  sourceUnits: TrajectorySourceUnits
  scope: ExperimentScope
  interval: readonly [number, number]
  method: ExperimentMethodSelection
  rule: ExperimentRule
  budget: ExperimentBudget
}

export interface MethodDescriptor {
  id: string
  version: string
  geometryKinds: readonly Geometry['kind'][]
  supportsStatic: boolean
  supportsMotion: boolean
  maxPairs: number
  warningWorkUnits?: number
}

export interface AnalysisColliderReference {
  bodyId: string
  colliderId: string
}

export interface AnalysisPair {
  id: string
  a: AnalysisColliderReference
  b: AnalysisColliderReference
}

export interface PreflightIssue {
  code: string
  message: string
  bodyIds?: readonly string[]
}

export interface PreflightReport {
  blockers: readonly PreflightIssue[]
  assumptions: readonly PreflightIssue[]
  resourceWarnings: readonly PreflightIssue[]
  pairs: readonly AnalysisPair[]
  estimate: {
    pairCount: number
    segmentCount: number
    workUnits: number
    reliableTimeEstimate: false
  }
}

export interface ExperimentSnapshot {
  version: 1
  snapshotId: string
  source: {
    candidateId: string
    experimentId: string
    experimentRevision: number
  }
  workcell: import('../domain/workcell').Workcell
  trajectory: Trajectory
  sourceUnits: TrajectorySourceUnits
  interval: readonly [number, number]
  scope: ExperimentScope
  pairs: readonly AnalysisPair[]
  method: ExperimentMethodSelection
  rule: ExperimentRule
  budget: ExperimentBudget
  acknowledgedWarnings: readonly string[]
}

const definitionFields = [
  'version',
  'revision',
  'trajectory',
  'sourceUnits',
  'scope',
  'interval',
  'method',
  'rule',
  'budget'
] as const
const scopeFields = [
  'primaryBodyIds',
  'influencingBodyIds',
  'selfCollision',
  'externalCollision',
  'excludedPairs',
  'acknowledgedExcludedVisibleBodyIds',
  'backgroundNote'
] as const
const methodFields = ['id', 'version', 'settings'] as const
const settingsFields = [
  'distanceTolerance',
  'timeTolerance',
  'maxIterations'
] as const
const ruleFields = ['version', 'revision', 'minimumClearance'] as const
const budgetFields = ['maxIntervals', 'maxDurationMs'] as const
const sourceUnitFields = ['time', 'joints'] as const
const trajectoryFields = ['version', 'keyframes'] as const
const keyframeFields = ['time', 'joints'] as const
const exclusionFields = ['version', 'a', 'b', 'reason'] as const

const positiveRevision = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1
const finiteIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max
const integerIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max
const validText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max
const uniqueIds = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length <= 64 &&
  value.every(validIdentifier) &&
  new Set(value).size === value.length

function validTrajectoryShape(input: unknown): input is Trajectory {
  if (!hasExactOwnKeys(input, trajectoryFields) || input.version !== 1)
    return false
  if (
    !Array.isArray(input.keyframes) ||
    input.keyframes.length < 1 ||
    input.keyframes.length > 2000
  )
    return false
  return input.keyframes.every(
    (frame) =>
      hasExactOwnKeys(frame, keyframeFields) &&
      typeof frame.time === 'number' &&
      Number.isFinite(frame.time) &&
      isPlainRecord(frame.joints) &&
      Object.values(frame.joints).every(
        (value) => typeof value === 'number' && Number.isFinite(value)
      )
  )
}

function validSourceUnits(input: unknown): input is TrajectorySourceUnits {
  if (!hasExactOwnKeys(input, sourceUnitFields)) return false
  if (input.time !== 'ms' && input.time !== 's') return false
  if (!isPlainRecord(input.joints)) return false
  return Object.values(input.joints).every((unit) =>
    ['deg', 'rad', 'mm', 'm'].includes(unit as TrajectoryJointUnit)
  )
}

export function validateExperimentDefinition(
  input: unknown
): asserts input is ExperimentDefinition {
  if (
    !hasExactOwnKeys(input, definitionFields) ||
    input.version !== 1 ||
    !positiveRevision(input.revision) ||
    !validTrajectoryShape(input.trajectory) ||
    !validSourceUnits(input.sourceUnits)
  )
    throw new Error('Invalid experiment definition')

  const scope = input.scope
  if (
    !hasExactOwnKeys(scope, scopeFields) ||
    !uniqueIds(scope.primaryBodyIds) ||
    !uniqueIds(scope.influencingBodyIds) ||
    typeof scope.selfCollision !== 'boolean' ||
    typeof scope.externalCollision !== 'boolean' ||
    !Array.isArray(scope.excludedPairs) ||
    scope.excludedPairs.length > 4096 ||
    !uniqueIds(scope.acknowledgedExcludedVisibleBodyIds) ||
    !validText(scope.backgroundNote, 2000)
  )
    throw new Error('Invalid experiment scope')
  for (const pair of scope.excludedPairs)
    if (
      !hasExactOwnKeys(pair, exclusionFields) ||
      pair.version !== 1 ||
      !validIdentifier(pair.a) ||
      !validIdentifier(pair.b) ||
      pair.a === pair.b ||
      !validText(pair.reason, 500)
    )
      throw new Error('Invalid experiment exclusion')

  if (
    !Array.isArray(input.interval) ||
    input.interval.length !== 2 ||
    !input.interval.every(Number.isFinite) ||
    input.interval[0] < 0 ||
    input.interval[0] > input.interval[1]
  )
    throw new Error('Invalid experiment interval')

  const method = input.method
  if (
    !hasExactOwnKeys(method, methodFields) ||
    !validIdentifier(method.id) ||
    !validText(method.version, 96) ||
    !hasExactOwnKeys(method.settings, settingsFields) ||
    !finiteIn(method.settings.distanceTolerance, 0.000000001, 1) ||
    !finiteIn(method.settings.timeTolerance, 0.000000001, 1) ||
    !integerIn(method.settings.maxIterations, 1, 256)
  )
    throw new Error('Invalid experiment method')

  const rule = input.rule
  if (
    !hasExactOwnKeys(rule, ruleFields) ||
    rule.version !== 1 ||
    !positiveRevision(rule.revision) ||
    !finiteIn(rule.minimumClearance, 0, 20)
  )
    throw new Error('Invalid experiment rule')

  const budget = input.budget
  if (
    !hasExactOwnKeys(budget, budgetFields) ||
    !integerIn(
      budget.maxIntervals,
      1,
      EXPERIMENT_RESOURCE_PROFILE.maxIntervals
    ) ||
    !integerIn(
      budget.maxDurationMs,
      EXPERIMENT_RESOURCE_PROFILE.minDurationMs,
      EXPERIMENT_RESOURCE_PROFILE.maxDurationMs
    )
  )
    throw new Error('Invalid experiment budget')
}

export function validExperimentDefinition(
  input: unknown
): input is ExperimentDefinition {
  try {
    validateExperimentDefinition(input)
    return true
  } catch {
    return false
  }
}
