import type { Core } from '@asyra/core'
import {
  validFieldObservations,
  type FieldObservation
} from '../common-apis/observation-contract'
import {
  validCandidateLineage,
  type CandidateLineage
} from '../common-apis/candidate-lineage'
import {
  MethodIds,
  MethodVersions,
  PropertyFields,
  PropertyTypes
} from '../constants'
import {
  DEFAULT_EXPERIMENT_BUDGET,
  validExperimentDefinition,
  type ExperimentDefinition
} from '../analysis/contracts'
import { IDENTITY_POSE } from '../domain/math'
import { hasExactOwnKeys } from '../domain/records'
import {
  validBodyParameters,
  validIdentifier,
  type BodyParameters
} from '../domain/workcell'

export const DEFAULT_BODY_PARAMETERS: BodyParameters = {
  role: 'fixture',
  pose: IDENTITY_POSE,
  joint: { kind: 'fixed', axis: [0, 1, 0], value: 0, min: 0, max: 0 },
  colliders: [],
  color: 0x5ba8a1
}
export const DEFAULT_EXPERIMENT_DEFINITION: ExperimentDefinition = {
  version: 1,
  revision: 1,
  trajectory: { version: 1, keyframes: [{ time: 0, joints: {} }] },
  sourceUnits: { time: 's', joints: {} },
  scope: {
    primaryBodyIds: [],
    influencingBodyIds: [],
    selfCollision: false,
    externalCollision: false,
    excludedPairs: [],
    acknowledgedExcludedVisibleBodyIds: [],
    backgroundNote: 'Scope must be configured before analysis.'
  },
  interval: [0, 0],
  method: {
    id: MethodIds.CONTINUOUS_CLEARANCE,
    version: MethodVersions.CONTINUOUS_CLEARANCE,
    settings: {
      distanceTolerance: 0.000001,
      timeTolerance: 0.0001,
      maxIterations: 64
    }
  },
  rule: { version: 1, revision: 1, minimumClearance: 0.02 },
  budget: { ...DEFAULT_EXPERIMENT_BUDGET }
}
export interface CandidateParameters {
  robotRootId: string | null
  lineage?: CandidateLineage
}
export interface RunReference {
  version: 1
  runId: string
  snapshotId: string
  experimentId: string
  observations?: readonly FieldObservation[]
}
export function validRunReference(
  value: unknown
): value is RunReference | null {
  if (value === null) return true
  return (
    hasExactOwnKeys(value, [
      'version',
      'runId',
      'snapshotId',
      'experimentId',
      ...(value &&
      typeof value === 'object' &&
      Object.hasOwn(value, 'observations')
        ? ['observations']
        : [])
    ]) &&
    value.version === 1 &&
    validIdentifier(value.runId) &&
    validIdentifier(value.snapshotId) &&
    validIdentifier(value.experimentId) &&
    (!Object.hasOwn(value, 'observations') ||
      validFieldObservations(value.observations))
  )
}
export function validBodyProperty(value: unknown): value is BodyParameters {
  return (
    validBodyParameters(value) &&
    !['id', 'parentId', 'name', 'visible'].some((key) =>
      Object.hasOwn(value, key)
    )
  )
}
export function validCandidateParameters(
  value: unknown
): value is CandidateParameters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const candidate = value as CandidateParameters
  return (
    (candidate.robotRootId === null ||
      validIdentifier(candidate.robotRootId)) &&
    (!Object.hasOwn(candidate, 'lineage') ||
      validCandidateLineage(candidate.lineage))
  )
}
export function installModelProperties(core: Core): void {
  const definitions = [
    {
      type: PropertyTypes.BODY,
      key: PropertyFields.BODY,
      defaultValue: DEFAULT_BODY_PARAMETERS,
      validate: validBodyProperty
    },
    {
      type: PropertyTypes.CANDIDATE,
      key: PropertyFields.CANDIDATE,
      defaultValue: { robotRootId: null },
      validate: validCandidateParameters
    },
    {
      type: PropertyTypes.EXPERIMENT,
      key: PropertyFields.EXPERIMENT,
      defaultValue: DEFAULT_EXPERIMENT_DEFINITION,
      validate: validExperimentDefinition
    },
    {
      type: PropertyTypes.RUN_REFERENCE,
      key: PropertyFields.RUN_REFERENCE,
      defaultValue: null,
      validate: validRunReference
    }
  ]
  for (const definition of definitions) {
    const defaults = {
      [definition.key]: structuredClone(definition.defaultValue)
    }
    core.registerPropertySchema({
      type: definition.type,
      fields: [
        {
          key: definition.key,
          kind: 'object',
          defaultValue: structuredClone(definition.defaultValue),
          validate: definition.validate
        }
      ]
    })
    core.definePropertyComponent({
      type: definition.type,
      defaults,
      persistKeys: [definition.key],
      valueKeys: [definition.key],
      allowDynamicKeys: false
    })
  }
}
