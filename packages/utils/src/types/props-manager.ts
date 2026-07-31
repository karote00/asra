import { PROPS_ACTIONS } from '../constants'
import { PropertyComponentRawData } from '../propsManager'
import { DataTypes } from './constants'
import type { ElementPropertyRelation } from './scene-tree'
import type { MutationOptions } from './change'
import type { YjsChange } from './yjs'

export interface AddRemovePropertyChange {
  action: PROPS_ACTIONS
  undoType: string
  undoAction: string
  eventName: string
  data: PropertyComponentRawData[]
  parentId?: string
  options?: MutationOptions
}

export interface UpdatePropertyChange {
  action: PROPS_ACTIONS
  eventName: string
  id: string
  key: string
  before: DataTypes
  after: DataTypes
  options?: MutationOptions
}

export type PropsChange = AddRemovePropertyChange | UpdatePropertyChange

export type PropsRestoreStrategy = 'reuse' | 'materialize'

export interface PropsRestoreSnapshot {
  readonly components: readonly PropertyComponentRawData[]
}

export interface PreparedPropsRestoreEntry {
  readonly componentId: string
  readonly strategy: PropsRestoreStrategy
}

export interface PreparedPropsRestore {
  readonly kind: 'prepared-props-restore'
  readonly entries: readonly PreparedPropsRestoreEntry[]
  readonly ownerRelations: readonly ElementPropertyRelation[]
}

export interface PropsYjsChange extends YjsChange<PropsChange> {}
