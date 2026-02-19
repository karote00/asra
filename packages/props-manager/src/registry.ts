export * from './ui-property-registry'
export * from './state-registry'

// Backward compatibility: Export as propertyRegistry (lowercase instance name)
export { uiPropertyRegistry as propertyRegistry } from './ui-property-registry'
export type { PropertyDefinition } from './ui-property-registry'
