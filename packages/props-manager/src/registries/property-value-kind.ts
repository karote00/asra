import type { PropertyValueKind } from '@asyra/utils'

export const matchesPropertyValueKind = (
  kind: PropertyValueKind,
  value: unknown
): boolean => {
  switch (kind) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'string':
      return typeof value === 'string'
    case 'boolean':
      return typeof value === 'boolean'
    case 'object':
      return (
        value === null ||
        (!!value && typeof value === 'object' && !Array.isArray(value))
      )
    case 'array':
      return Array.isArray(value)
    case 'custom':
      return true
  }
}
