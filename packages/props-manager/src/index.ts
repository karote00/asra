import { initPropXSubscribes } from './manager/subscribes'
import propsManager, { PropsManager } from './manager/props-manager'
import elementPropertyRegistry from './registries/property-definition'
import stateRegistry from './registries/state'
import {
  propertyComponentRegistry,
  registerPropertyComponent,
  clonePropertyComponentConfigRegistration,
  getPropertyComponent,
  getPropertyComponentConfigDefinition,
  unregisterPropertyComponent
} from './registries/property-component'
import { BasePropertyComponent } from './components'
import {
  getPropertyComponentAccessor,
  runWithPropertyComponentAccessor,
  type PropertyComponentAccessor
} from './manager/component-accessor'

initPropXSubscribes()

export default propsManager
export {
  PropsManager,
  elementPropertyRegistry,
  stateRegistry,
  propertyComponentRegistry,
  registerPropertyComponent,
  clonePropertyComponentConfigRegistration,
  getPropertyComponent,
  getPropertyComponentConfigDefinition,
  unregisterPropertyComponent,
  BasePropertyComponent,
  getPropertyComponentAccessor,
  runWithPropertyComponentAccessor
}
export type { PropertyDefinition } from './registries/property-definition'
export type { PropertyComponentConstructor } from './components'
export {
  propertySchemaRegistry,
  registerPropertySchema,
  getPropertySchema,
  unregisterPropertySchema
} from './registries/property-schema'
export type { PropertyRegistrationOptions } from './registries/registration-options'
export type {
  PropertyChildRelationDefinition,
  PropertyComponentConfigRegistration
} from './registries/property-component'
export type { PropertyComponentAccessor }
export {
  clonePropertyDefinitionRecord,
  clonePropertyDefinitionValue
} from './registries/property-definition-value'
export {
  PROPERTY_REGISTRATION_ERROR_CODES,
  PROPERTY_REGISTRATION_SCOPES,
  PropertyRegistrationError,
  unregisterPropertyRegistration
} from './registries/property-registration'
export type {
  PropertyRegistrationErrorCode,
  PropertyRegistrationInUseFailure,
  PropertyRegistrationScope,
  PropertyRegistrationUnregisterMissing,
  PropertyRegistrationUnregisterResult,
  PropertyRegistrationUnregisterSuccess
} from './registries/property-registration'
export {
  commitDeclarativePropertyTypeDefinition,
  createPropertyComponentFromConfig,
  getDeclarativePropertyTypeDefinition,
  PROPERTY_TYPE_DEFINITION_ERROR_CODES,
  PropertyTypeDefinitionError
} from './registries/declarative-property-type'
export type {
  PropertyTypeDefinition,
  PropertyTypeDefinitionErrorCode,
  PropertyTypeDefinitionFailure,
  PropertyTypeFieldDefinition
} from './registries/declarative-property-type'
