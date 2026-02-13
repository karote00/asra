import uiContext, { UIContext } from './ui-context'

export * from './subscribes'
export { UIContext }
export { propertyRegistry } from './property-registry'
export type {
  PropertyValue,
  PropertyRegistration,
  TriggerConfig,
  PropertyComputeContext
} from './property-registry'
export default uiContext
