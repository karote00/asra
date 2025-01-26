import { OWNER, SCENE_TREE_ACTIONS } from '../enums'
import type { ElementRawData } from '../sceneTree'
import type { YjsChange } from './yjs'

export interface SceneTreeChangePayload {
  owner: OWNER
  action: SCENE_TREE_ACTIONS
  parentId: string
  index: number
  data: ElementRawData
}

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChangePayload> {}
