import { OWNER, PROPS_ACTIONS } from '../enums'
import { PropertyComponentRawData } from '../propsManager'
import { DataTypes } from './constants'
import type { YjsChange } from './yjs'

export interface AddRemovePropertyChange {
  action: PROPS_ACTIONS
  owner: OWNER
  undoType: string
  undoAction: string
  eventName: string
  data: PropertyComponentRawData
  parentId?: string
}

export interface UpdatePropertyChange {
  action: PROPS_ACTIONS
  owner: OWNER
  eventName: string
  elementId: string
  key: string
  before: DataTypes
  after: DataTypes
}

export type PropsChange = AddRemovePropertyChange | UpdatePropertyChange

export interface PropsYjsChange extends YjsChange<PropsChange> {}
