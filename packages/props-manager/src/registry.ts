export * from './property-definition-registry'
export * from './state-registry'

// Backward compatibility: Export as propertyRegistry (lowercase instance name)
export { propertyDefinitionRegistry as propertyRegistry } from './property-definition-registry'
export type { PropertyDefinition } from './property-definition-registry'
