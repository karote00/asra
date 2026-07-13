import { PROPS_ACTIONS } from '../constants'
import { PropertyComponentRawData } from '../propsManager'
import { DataTypes } from './constants'
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

export interface PropsYjsChange extends YjsChange<PropsChange> {}
