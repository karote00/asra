import type { ExperimentSnapshot } from '../analysis/contracts'
import {
  createExperimentSnapshot,
  validateHistoricalSnapshot
} from '../analysis/snapshot'
import type { MethodCatalog } from './catalog'

/** Inputs have passed the bounded descriptor schema; object-key order is not semantic. */
function sameDeclaration(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        Object.hasOwn(b, key) &&
        sameDeclaration(Reflect.get(a, key), Reflect.get(b, key))
    )
  )
}

/** Reuse the snapshot owner's admission before allocation and at the Worker boundary. */
export function admitSnapshotExecution(
  input: unknown,
  catalog: MethodCatalog
): ExperimentSnapshot {
  const snapshot = validateHistoricalSnapshot(input),
    installed = catalog.resolve(snapshot.method.id, snapshot.method.version)
  if (
    snapshot.methodDescriptor &&
    !sameDeclaration(snapshot.methodDescriptor, installed.descriptor)
  )
    throw new Error(
      'Installed method declaration differs from the frozen snapshot; create a new experiment snapshot'
    )
  return createExperimentSnapshot({
    snapshotId: snapshot.snapshotId,
    candidateId: snapshot.source.candidateId,
    experimentId: snapshot.source.experimentId,
    workcell: snapshot.workcell,
    definition: {
      version: 1,
      revision: snapshot.source.experimentRevision,
      trajectory: snapshot.trajectory,
      sourceUnits: snapshot.sourceUnits,
      interval: snapshot.interval,
      scope: snapshot.scope,
      method: snapshot.method,
      rule: snapshot.rule,
      budget: snapshot.budget
    },
    methods: catalog.descriptors,
    acknowledgedWarningCodes: snapshot.acknowledgedWarnings
  })
}
