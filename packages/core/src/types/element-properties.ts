import type { EVENT_OPTIONS } from '@asyra/utils'

export interface ElementPropertyValuesUpdate {
  readonly elementId: string
  readonly values: Readonly<Record<string, unknown>>
}

export type ElementPropertyRecordFields = Readonly<Record<string, unknown>> & {
  readonly id?: never
  readonly type?: never
}

export interface ElementPropertyRecordPatch {
  readonly key: string
  readonly set?: Readonly<Record<string, ElementPropertyRecordFields>>
  readonly remove?: readonly string[]
}

export interface ElementPropertyPatchUpdate {
  readonly elementId: string
  readonly values?: Readonly<Record<string, unknown>>
  readonly records: readonly ElementPropertyRecordPatch[]
}

export interface ElementPropertyAPIs {
  updateElementProperties: (
    updates: readonly ElementPropertyValuesUpdate[],
    options?: EVENT_OPTIONS
  ) => readonly string[]
  patchElementProperties: (
    patches: readonly ElementPropertyPatchUpdate[],
    options?: EVENT_OPTIONS
  ) => readonly string[]
}
