import { PROPS_ACTIONS } from '../constants'
import { PropertyComponentRawData } from '../propsManager'
import { DataTypes } from './constants'
import type { ElementPropertyOwnerRelation } from './scene-tree'
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
  ownerElementId?: string
  ownerPropertyName?: string
  options?: MutationOptions
}

export type PropsChange = AddRemovePropertyChange | UpdatePropertyChange

export type PropsRestoreStrategy = 'reuse' | 'materialize'

export interface PropsRestoreSnapshot {
  readonly components: readonly PropertyComponentRawData[]
}

export interface PropsRestorePlanEntry {
  readonly componentId: string
  readonly strategy: PropsRestoreStrategy
}

export interface PropsRestorePlan {
  readonly kind: 'props-restore-plan'
  readonly entries: readonly PropsRestorePlanEntry[]
  readonly ownerRelations: readonly ElementPropertyOwnerRelation[]
}

export interface PropsYjsChange extends YjsChange<PropsChange> {}
