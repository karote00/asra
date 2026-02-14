// Framework-first: Use string type instead of enum for extensibility
export type EntityType = string

// Export common types as constants (not enum)
export const EntityTypes = {
  UNDEFINED: 'undefined',
  WORKSPACE: 'workspace',
  FRAME: 'frame',
  GROUP: 'group',
  ELEMENT: 'element',
  RECTANGLE: 'rectangle',
  OVAL: 'oval'
} as const
