import { OWNER, SCENE_TREE_ACTIONS } from '../enums'
import type { ElementRawData } from '../sceneTree'
import type { YjsChange } from './yjs'

export type DataTypes = boolean | number | string | (number | string)[] | symbol

export interface AddRemoveElementChange {
  action: SCENE_TREE_ACTIONS
  owner: OWNER
  undoType: string
  undoAction: string
  eventName: string
  data: ElementRawData
  parentId?: string
}

export interface UpdateElementChange {
  action: SCENE_TREE_ACTIONS
  owner: OWNER
  eventName: string
  elementId: string
  key: string
  before: DataTypes
  after: DataTypes
}

export type SceneTreeChange = AddRemoveElementChange | UpdateElementChange

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChange> {}
