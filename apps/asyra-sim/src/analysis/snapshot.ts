import { validIdentifier } from '../domain/workcell'
import { preflightExperiment } from './preflight'
import type {
  ExperimentDefinition,
  ExperimentSnapshot,
  MethodDescriptor
} from './contracts'
import type { Workcell } from '../domain/workcell'

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
    acknowledgedWarnings: [...input.acknowledgedWarningCodes]
  })
}
