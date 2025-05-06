import { OWNER, SCENE_TREE_ACTIONS } from '../constants'
import type { ElementRawData } from '../sceneTree'
import { DataTypes } from './constants'
import type { YjsChange } from './yjs'

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
  id: string
  key: string
  before: DataTypes
  after: DataTypes
}

export type SceneTreeChange = AddRemoveElementChange | UpdateElementChange

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChange> {}
