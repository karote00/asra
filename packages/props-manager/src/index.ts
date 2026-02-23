import { initPropXSubscribes } from './manager/subscribes'
import propsManager, { PropsManager } from './manager/props-manager'
import propertyDefinitionRegistry from './registries/property-definition'
import stateRegistry from './registries/state'
import { propertyRegistry } from './registries'

initPropXSubscribes()

export default propsManager
export {
  PropsManager,
  propertyDefinitionRegistry,
  stateRegistry,
  propertyRegistry
}
export type { PropertyDefinition } from './registries/property-definition'
export {
  propertySchemaRegistry,
  registerPropertySchema,
  getPropertySchema
} from './registries/property-schema'
export type { RegisterPropertySchemaOptions } from './registries/property-schema'
