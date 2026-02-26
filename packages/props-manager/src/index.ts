import { initPropXSubscribes } from './manager/subscribes'
import propsManager, { PropsManager } from './manager/props-manager'
import propertyDefinitionRegistry from './registries/property-definition'
import stateRegistry from './registries/state'
import { propertyRegistry } from './registries'
import {
  propertyComponentRegistry,
  registerPropertyComponent,
  getPropertyComponent
} from './registries/property-component'
import {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
} from './components'

initPropXSubscribes()

export default propsManager
export {
  PropsManager,
  propertyDefinitionRegistry,
  stateRegistry,
  propertyRegistry,
  propertyComponentRegistry,
  registerPropertyComponent,
  getPropertyComponent,
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
}
export type { PropertyDefinition } from './registries/property-definition'
export type {
  PropertyComponentType,
  PropertyComponentConstructor
} from './components'
export {
  propertySchemaRegistry,
  registerPropertySchema,
  getPropertySchema
} from './registries/property-schema'
export type { RegisterPropertySchemaOptions } from './registries/property-schema'
export type { RegisterPropertyComponentOptions } from './registries/property-component'
