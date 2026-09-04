import { validIdentifier } from '../domain/workcell'
import { inspectHistoricalExperiment, preflightExperiment } from './preflight'
import { hasExactOwnKeys, isPlainRecord } from '../domain/records'
import {
  validateInstalledDescriptor,
  validParameterValues
} from '../extensions/descriptor'
import type {
  ExperimentDefinition,
  ExperimentSnapshot,
  MethodDescriptor
} from './contracts'
import type { Workcell } from '../domain/workcell'
import { EXPERIMENT_RESOURCE_PROFILE } from './contracts'

export interface CreateExperimentSnapshotInput {
  snapshotId: string
  candidateId: string
  experimentId: string
  workcell: Workcell
  definition: ExperimentDefinition
  methods: readonly MethodDescriptor[]
  acknowledgedWarningCodes: readonly string[]
}

function deepFreeze<T>(input: T, seen = new WeakSet<object>()): T {
  if (!input || typeof input !== 'object' || seen.has(input)) return input
  seen.add(input)
  for (const value of Object.values(input)) deepFreeze(value, seen)
  return Object.freeze(input)
}

export function createExperimentSnapshot(
  input: CreateExperimentSnapshotInput
): ExperimentSnapshot {
  if (
    !validIdentifier(input.snapshotId) ||
    !validIdentifier(input.candidateId) ||
    !validIdentifier(input.experimentId)
  )
    throw new Error('Invalid snapshot source identity')
  const workcell = structuredClone(input.workcell),
    definition = structuredClone(input.definition),
    report = preflightExperiment(workcell, definition, input.methods)
  if (report.blockers.length)
    throw new Error(
      `Experiment preflight blocked: ${report.blockers[0]?.message}`
    )
  const required = [
    ...report.assumptions.map((warning) => warning.code),
    ...report.resourceWarnings.map((warning) => warning.code)
  ]
  if (required.some((code) => !input.acknowledgedWarningCodes.includes(code)))
    throw new Error('Every preflight warning requires explicit acknowledgement')
  const unexpected = input.acknowledgedWarningCodes.filter(
    (code) => !required.includes(code)
  )
  if (unexpected.length)
    throw new Error('Unknown preflight warning acknowledgement')

  const selected = input.methods.find(
    (method) =>
      method.id === definition.method.id &&
      method.version === definition.method.version
  )
  let methodDescriptor: ExperimentSnapshot['methodDescriptor']
  if (selected?.manifest) {
    validateInstalledDescriptor(selected)
    methodDescriptor = structuredClone(selected)
  }

  return deepFreeze({
    version: 1,
    snapshotId: input.snapshotId,
    source: {
      candidateId: input.candidateId,
      experimentId: input.experimentId,
      experimentRevision: definition.revision
    },
    workcell,
    trajectory: definition.trajectory,
    sourceUnits: definition.sourceUnits,
    interval: definition.interval,
    scope: definition.scope,
    pairs: report.pairs,
    method: definition.method,
    rule: definition.rule,
    budget: definition.budget,
    ...(methodDescriptor ? { methodDescriptor } : {}),
    acknowledgedWarnings: [...input.acknowledgedWarningCodes]
  })
}

/** Read-only historical admission; this artifact never grants permission to rerun. */
export function validateHistoricalSnapshot(input: unknown): ExperimentSnapshot {
  if (
    !hasExactOwnKeys(input, [
      'version',
      'snapshotId',
      'source',
      'workcell',
      'trajectory',
      'sourceUnits',
      'interval',
      'scope',
      'pairs',
      'method',
      'rule',
      'budget',
      'acknowledgedWarnings',
      ...(isPlainRecord(input) && Object.hasOwn(input, 'methodDescriptor')
        ? ['methodDescriptor']
        : [])
    ]) ||
    input.version !== 1 ||
    !validIdentifier(input.snapshotId) ||
    !hasExactOwnKeys(input.source, [
      'candidateId',
      'experimentId',
      'experimentRevision'
    ]) ||
    !validIdentifier(input.source.candidateId) ||
    !validIdentifier(input.source.experimentId) ||
    !Array.isArray(input.pairs) ||
    input.pairs.length > EXPERIMENT_RESOURCE_PROFILE.maxPairs ||
    !Array.isArray(input.acknowledgedWarnings) ||
    input.acknowledgedWarnings.length > 64 ||
    !input.acknowledgedWarnings.every(
      (value) =>
        typeof value === 'string' && value.length > 0 && value.length <= 200
    ) ||
    new Set(input.acknowledgedWarnings).size !==
      input.acknowledgedWarnings.length
  )
    throw new Error('Invalid historical snapshot envelope')
  const snapshot = structuredClone(input) as unknown as ExperimentSnapshot
  if (Object.hasOwn(snapshot, 'methodDescriptor')) {
    validateInstalledDescriptor(snapshot.methodDescriptor)
    if (
      snapshot.methodDescriptor.id !== snapshot.method.id ||
      snapshot.methodDescriptor.version !== snapshot.method.version
    )
      throw new Error('Historical method descriptor identity mismatch')
    if (
      !validParameterValues(
        snapshot.methodDescriptor.parameterSchema,
        snapshot.method.settings.parameters ?? {}
      )
    )
      throw new Error(
        'Historical method parameters do not match the retained declaration'
      )
  }
  const report = inspectHistoricalExperiment(snapshot.workcell, {
    version: snapshot.version,
    revision: snapshot.source.experimentRevision,
    trajectory: snapshot.trajectory,
    sourceUnits: snapshot.sourceUnits,
    scope: snapshot.scope,
    interval: snapshot.interval,
    method: snapshot.method,
    rule: snapshot.rule,
    budget: snapshot.budget
  })
  if (report.blockers.length)
    throw new Error(
      `Invalid historical snapshot: ${report.blockers[0]?.message}`
    )
  if (
    report.assumptions.some(
      (issue) => !snapshot.acknowledgedWarnings.includes(issue.code)
    )
  )
    throw new Error('Historical snapshot has unacknowledged assumptions')
  if (
    snapshot.pairs.length !== report.pairs.length ||
    snapshot.pairs.some((pair, index) => {
      const expected = report.pairs[index]
      return (
        !hasExactOwnKeys(pair, ['id', 'a', 'b']) ||
        !hasExactOwnKeys(pair.a, ['bodyId', 'colliderId']) ||
        !hasExactOwnKeys(pair.b, ['bodyId', 'colliderId']) ||
        pair.id !== expected?.id ||
        pair.a.bodyId !== expected.a.bodyId ||
        pair.a.colliderId !== expected.a.colliderId ||
        pair.b.bodyId !== expected.b.bodyId ||
        pair.b.colliderId !== expected.b.colliderId
      )
    })
  )
    throw new Error('Historical snapshot pairs do not match its declared scope')
  return deepFreeze(snapshot)
}
