// Framework-first: Use string type instead of enum for extensibility
export type NameType = string

// Keep as constants for built-in types
export const NameTypes = {
  WORKSPACE: 'workspace',
  FRAME: 'frame',
  GROUP: 'group',
  ELEMENT: 'element',
  RECTANGLE: 'rectangle'
} as const
