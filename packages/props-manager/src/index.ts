import { initPropXSubscribes } from './subscribes'
import propsManager, { PropsManager } from './props-manager'
import propertyDefinitionRegistry from './property-definition-registry'
import stateRegistry from './state-registry'
import { propertyRegistry } from './registry'

initPropXSubscribes()

export default propsManager
export {
  PropsManager,
  propertyDefinitionRegistry,
  stateRegistry,
  propertyRegistry
}
export type { PropertyDefinition } from './property-definition-registry'
export {
  propertySchemaRegistry,
  registerPropertySchema,
  getPropertySchema
} from './schema-registry'
export type { RegisterPropertySchemaOptions } from './schema-registry'
