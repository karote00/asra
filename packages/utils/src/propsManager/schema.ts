export type PropertyValueKind =
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'array'
  | 'custom'

export type PropertyUnitKind = 'px' | 'pct' | 'auto' | 'custom'

export interface PropertyFieldSchema<T = unknown> {
  key: string
  kind: PropertyValueKind
  allowedUnits?: PropertyUnitKind[]
  defaultValue?: T
  validate?: (value: T) => boolean
}

export interface PropertySchema {
  type: string
  fields: PropertyFieldSchema[]
}
