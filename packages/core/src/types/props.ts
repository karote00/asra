import {
  ElementPropertyRelation,
  PropsComponentRawData,
  PreparedPropsRestore,
  PropsRestoreSnapshot,
  type EVENT_OPTIONS
} from '@asyra/utils'

export interface PropertyComponentValuesUpdate {
  readonly propertyId: string
  readonly values: Readonly<Record<string, unknown>>
}

export interface PropsRawAPIs {
  propsLoadData: (data: PropsComponentRawData) => void
  propsSaveData: () => PropsComponentRawData
  preflightRestoreProperties: (
    snapshot: PropsRestoreSnapshot,
    ownerRelations: readonly ElementPropertyRelation[]
  ) => PreparedPropsRestore
  applyRestoreProperties: (
    preparedRestore: PreparedPropsRestore,
    options?: EVENT_OPTIONS
  ) => readonly string[]
  updatePropertyComponents: (
    updates: readonly PropertyComponentValuesUpdate[],
    options?: EVENT_OPTIONS
  ) => readonly string[]
}

export type PropsAPIs = PropsRawAPIs
