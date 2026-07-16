import propsManager, { PropsManager } from '../manager/props-manager'
import {
  propertyComponentRegistry,
  unregisterPropertyComponent
} from './property-component'
import {
  propertySchemaRegistry,
  unregisterPropertySchema
} from './property-schema'

export const PROPERTY_REGISTRATION_ERROR_CODES = [
  'PROPERTY_REGISTRATION_NOT_FOUND',
  'PROPERTY_TYPE_IN_USE'
] as const

export type PropertyRegistrationErrorCode =
  (typeof PROPERTY_REGISTRATION_ERROR_CODES)[number]

export interface PropertyRegistrationUnregisterSuccess {
  ok: true
  type: string
  removedSchema: boolean
  removedComponent: boolean
}

export interface PropertyRegistrationUnregisterMissing {
  ok: false
  code: 'PROPERTY_REGISTRATION_NOT_FOUND'
  type: string
  removedSchema: false
  removedComponent: false
}

export interface PropertyRegistrationInUseFailure {
  ok: false
  code: 'PROPERTY_TYPE_IN_USE'
  type: string
  propertyIds: readonly string[]
  removedSchema: false
  removedComponent: false
}

export type PropertyRegistrationUnregisterResult =
  | PropertyRegistrationUnregisterSuccess
  | PropertyRegistrationUnregisterMissing

export class PropertyRegistrationError extends Error {
  readonly code: PropertyRegistrationErrorCode
  readonly type: string
  readonly propertyIds: readonly string[]
  readonly result: PropertyRegistrationInUseFailure

  constructor(result: PropertyRegistrationInUseFailure) {
    super(
      `Property registration "${result.type}" is in use by: ${result.propertyIds.join(', ')}`
    )
    this.name = 'PropertyRegistrationError'
    this.code = result.code
    this.type = result.type
    this.propertyIds = [...result.propertyIds]
    this.result = {
      ...result,
      propertyIds: [...result.propertyIds]
    }
  }
}

export const unregisterPropertyRegistration = (
  type: string,
  manager: PropsManager = propsManager
): PropertyRegistrationUnregisterResult => {
  const hasSchema = propertySchemaRegistry.has(type)
  const hasComponent = propertyComponentRegistry.has(type)
  if (!hasSchema && !hasComponent) {
    return {
      ok: false,
      code: 'PROPERTY_REGISTRATION_NOT_FOUND',
      type,
      removedSchema: false,
      removedComponent: false
    }
  }

  const propertyIds = manager.getPropertyIdsByType(type)
  if (propertyIds.length > 0) {
    throw new PropertyRegistrationError({
      ok: false,
      code: 'PROPERTY_TYPE_IN_USE',
      type,
      propertyIds,
      removedSchema: false,
      removedComponent: false
    })
  }

  return {
    ok: true,
    type,
    removedSchema: hasSchema ? unregisterPropertySchema(type) : false,
    removedComponent: hasComponent ? unregisterPropertyComponent(type) : false
  }
}
