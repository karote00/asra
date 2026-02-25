import { OWNER, SCENE_TREE_ACTIONS } from '../constants'
import type { ElementRawData } from '../sceneTree'
import { DataTypes } from './constants'
import type { MutationOptions } from './change'
import type { YjsChange } from './yjs'

export interface AddRemoveElementChange {
  action: SCENE_TREE_ACTIONS
  owner: OWNER
  undoType: string
  undoAction: string
  eventName: string
  data: ElementRawData
  parentId?: string
  options?: MutationOptions
}

export interface UpdateElementChange {
  action: SCENE_TREE_ACTIONS
  owner: OWNER
  eventName: string
  id: string
  key: string
  before: DataTypes
  after: DataTypes
  options?: MutationOptions
}

export type SceneTreeChange = AddRemoveElementChange | UpdateElementChange

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChange> {}
