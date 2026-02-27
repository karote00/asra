import { initPropXSubscribes } from './manager/subscribes'
import propsManager, { PropsManager } from './manager/props-manager'
import elementPropertyRegistry from './registries/property-definition'
import stateRegistry from './registries/state'
import {
  propertyComponentRegistry,
  registerPropertyComponent,
  getPropertyComponent
} from './registries/property-component'
import { BasePropertyComponent } from './components'
import {
  getPropertyComponentAccessor,
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
  getPropertyComponent,
  BasePropertyComponent,
  getPropertyComponentAccessor
}
export type { PropertyDefinition } from './registries/property-definition'
export type { PropertyComponentConstructor } from './components'
export {
  propertySchemaRegistry,
  registerPropertySchema,
  getPropertySchema
} from './registries/property-schema'
export type { RegisterPropertySchemaOptions } from './registries/property-schema'
export type { RegisterPropertyComponentOptions } from './registries/property-component'
export type { PropertyComponentAccessor }
