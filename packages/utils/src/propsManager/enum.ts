// Framework-first: Use string type instead of enum for extensibility
export type PropertyType = string

// Export common types as constants (not enum)
export const PropertyTypes = {
  POSITION: 'position',
  DIMENSION: 'dimension',
  CUSTOM: 'custom'
} as const
