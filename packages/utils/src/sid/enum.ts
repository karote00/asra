// Framework-first: Use string type instead of enum for extensibility
export type IDType = string

// Keep as constants for built-in types
export const IDTypes = {
  DEFAULT: 'default',
  WORKSPACE: 'ws',
  GROUP: 'gp',
  FRAME: 'fr',
  ELEMENT: 'el',
  PROPS: 'pp'
} as const
