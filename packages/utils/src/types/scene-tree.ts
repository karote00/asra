import { OWNER, SCENE_TREE_ACTIONS } from '../enums'
import type { ElementRawData } from '../sceneTree'
import type { YjsChange } from './yjs'

export type DataTypes = boolean | number | string | (number | string)[]

export type AddRemoveElementPayload = {
  owner: OWNER
  action: SCENE_TREE_ACTIONS
  parentId: string
  index: number
  data: ElementRawData
}

export type UpdateElementPayload = {
  owner: OWNER
  action: SCENE_TREE_ACTIONS
  elementId: string
  key: string
  before: DataTypes
  after: DataTypes
}

export type SceneTreeChangePayload =
  | AddRemoveElementPayload
  | UpdateElementPayload

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChangePayload> {}
