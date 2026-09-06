import { inspectHistoricalExperiment } from '../preflight'
import {
  validateHistoricalSnapshot,
  type CreateExperimentSnapshotInput
} from '../snapshot'

/** Test-only v1 record authoring. Never use historical admission to start a new run. */
export function historicalProxyFixture(input: CreateExperimentSnapshotInput) {
  const definition = input.definition
  const report = inspectHistoricalExperiment(input.workcell, definition)
  if (report.blockers.length)
    throw new Error('Invalid historical fixture scope')
  const descriptor = input.methods.find(
    (method) =>
      method.id === definition.method.id &&
      method.version === definition.method.version
  )
  return validateHistoricalSnapshot({
    version: 1,
    snapshotId: input.snapshotId,
    source: {
      candidateId: input.candidateId,
      experimentId: input.experimentId,
      experimentRevision: definition.revision
    },
    workcell: input.workcell,
    trajectory: definition.trajectory,
    sourceUnits: definition.sourceUnits,
    interval: definition.interval,
    scope: definition.scope,
    pairs: report.pairs,
    method: definition.method,
    rule: definition.rule,
    budget: definition.budget,
    ...(descriptor?.manifest ? { methodDescriptor: descriptor } : {}),
    acknowledgedWarnings: input.acknowledgedWarningCodes
  })
}
