export * from './property-definition'
export * from './state'

// Backward compatibility: Export as propertyRegistry (lowercase instance name)
export { propertyDefinitionRegistry as propertyRegistry } from './property-definition'
export type { PropertyDefinition } from './property-definition'
