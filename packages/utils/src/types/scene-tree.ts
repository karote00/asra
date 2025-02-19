import { OWNER, SCENE_TREE_ACTIONS } from '../enums'
import type { ElementRawData } from '../sceneTree'
import type { YjsChange } from './yjs'

export type DataTypes = boolean | number | string | (number | string)[]

export interface SceneTreeChangePayload {
  owner: OWNER
  action: SCENE_TREE_ACTIONS
  elementId: string
  parentId: string
  index: number
  key: string
  data: ElementRawData
  before: DataTypes
  after: DataTypes
}

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChangePayload> {}
