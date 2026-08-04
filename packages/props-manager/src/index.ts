import { initPropXSubscribes } from './manager/subscribes.js'
import propsManager, { PropsManager } from './manager/props-manager.js'
import elementPropertyRegistry from './registries/property-definition.js'
import stateRegistry from './registries/state.js'
import {
  propertyComponentRegistry,
  registerPropertyComponent,
  clonePropertyComponentConfigRegistration,
  getPropertyComponent,
  getPropertyComponentCanonicalChildRelation,
  getPropertyComponentConfigDefinition,
  unregisterPropertyComponent
} from './registries/property-component.js'
import { BasePropertyComponent } from './components/index.js'
import {
  getPropertyComponentAccessor,
  runWithPropertyComponentAccessor,
  type PropertyComponentAccessor
} from './manager/component-accessor.js'

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
  getPropertyComponentCanonicalChildRelation,
  getPropertyComponentConfigDefinition,
  unregisterPropertyComponent,
  BasePropertyComponent,
  getPropertyComponentAccessor,
  runWithPropertyComponentAccessor
}
export type { PropertyDefinition } from './registries/property-definition.js'
export type {
  PreparedActivePropertyBatch,
  PreparedPropertyCreationBatch,
  OrdinaryPropertyCreationOwner,
  PreparedOrdinaryPropertyCreationBatch,
  PreparedPropsTransactionEvent,
  CanonicalPropertyDeliveryOwner,
  CanonicalPropertyDeliveryRecord,
  PropertyValuesMutation,
  PropertyRecordsMutation,
  CreateOwnerPropertiesMutation,
  CreateExactPropertyGraphMutation,
  RemoveExactOrphanPropertyGraphsMutation,
  PropertyMutation,
  PropertyMutationBatchRequest,
  PreparedPropertyMutationBatch,
  PropertyMutationBatchResult
} from './manager/props-manager.js'
export type { PropertyComponentConstructor } from './components/index.js'
export {
  propertySchemaRegistry,
  registerPropertySchema,
  getPropertySchema,
  unregisterPropertySchema
} from './registries/property-schema.js'
export type { PropertyRegistrationOptions } from './registries/registration-options.js'
export type {
  PropertyChildRelationDefinition,
  PropertyComponentConfigRegistration
} from './registries/property-component.js'
export type { PropertyComponentAccessor }
export {
  clonePropertyDefinitionRecord,
  clonePropertyDefinitionValue
} from './registries/property-definition-value.js'
export {
  PROPERTY_REGISTRATION_ERROR_CODES,
  PROPERTY_REGISTRATION_SCOPES,
  PropertyRegistrationError,
  unregisterPropertyRegistration
} from './registries/property-registration.js'
export type {
  PropertyRegistrationErrorCode,
  PropertyRegistrationInUseFailure,
  PropertyRegistrationScope,
  PropertyRegistrationUnregisterMissing,
  PropertyRegistrationUnregisterResult,
  PropertyRegistrationUnregisterSuccess
} from './registries/property-registration.js'
export {
  commitDeclarativePropertyTypeDefinition,
  createPropertyComponentFromConfig,
  getDeclarativePropertyTypeDefinition,
  PROPERTY_TYPE_DEFINITION_ERROR_CODES,
  PropertyTypeDefinitionError
} from './registries/declarative-property-type.js'
export type {
  PropertyTypeDefinition,
  PropertyTypeDefinitionErrorCode,
  PropertyTypeDefinitionFailure,
  PropertyTypeFieldDefinition
} from './registries/declarative-property-type.js'
