import { SCENE_TREE_ACTIONS } from '../constants'
import type { ElementRawData } from '../sceneTree'
import { DataTypes } from './constants'
import type { MutationOptions } from './change'
import type { YjsChange } from './yjs'

export interface AddRemoveElementChange {
  action: SCENE_TREE_ACTIONS
  undoType: string
  undoAction: string
  eventName: string
  data: ElementRawData
  parentId?: string
  options?: MutationOptions
}

export interface UpdateElementChange {
  action: SCENE_TREE_ACTIONS
  eventName: string
  id: string
  key: string
  before: DataTypes
  after: DataTypes
  options?: MutationOptions
}

export interface UpdateElementBatchChange {
  action: SCENE_TREE_ACTIONS
  eventName: string
  id: string
  changes: {
    key: string
    before: DataTypes
    after: DataTypes
  }[]
  options?: MutationOptions
}

export interface ComputedDataRecordPatch {
  set?: Record<string, DataTypes>
  remove?: string[]
}

export interface ComputedDataPatch {
  values?: Record<string, DataTypes>
  records?: Record<string, ComputedDataRecordPatch>
}

export interface ComputedDataPatchChange {
  values?: Record<
    string,
    {
      before: DataTypes
      after: DataTypes
    }
  >
  records?: Record<
    string,
    {
      set?: Record<
        string,
        {
          before?: DataTypes
          after: DataTypes
        }
      >
      remove?: Record<
        string,
        {
          before: DataTypes
        }
      >
    }
  >
}

export interface UpdateElementPatchChange {
  action: SCENE_TREE_ACTIONS
  eventName: string
  id: string
  patch: ComputedDataPatchChange
  options?: MutationOptions
}

export type SceneTreeChange =
  | AddRemoveElementChange
  | UpdateElementChange
  | UpdateElementBatchChange
  | UpdateElementPatchChange

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChange> {}
