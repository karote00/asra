import type { Core } from '@asyra/core'
import { PropertyFields, PropertyTypes } from '../constants'
import { IDENTITY_POSE } from '../domain/math'
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
export interface CandidateParameters {
  robotRootId: string | null
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
    candidate.robotRootId === null || validIdentifier(candidate.robotRootId)
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
