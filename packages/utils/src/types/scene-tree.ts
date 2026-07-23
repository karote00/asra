import { SCENE_TREE_ACTIONS } from '../constants'
import type { ElementRawData, GroupRawData } from '../sceneTree'
import { DataTypes } from './constants'
import type { MutationOptions } from './change'
import type { YjsChange } from './yjs'

export type SceneTreeDataOwner = 'raw' | 'computed'

export interface HierarchyLocation {
  parentId: string
  index: number
}

export interface HierarchyMove {
  elementId: string
  before: HierarchyLocation
  after: HierarchyLocation
}

export interface MoveHierarchyRequest {
  elementIds: readonly string[]
  targetParentId: string
  targetIndex: number
}

export interface MoveHierarchyResult {
  elementIds: readonly string[]
  moves: readonly HierarchyMove[]
}

export interface SubtreeRemovalEntry {
  elementId: string
  parentId: string
  index: number
  data: ElementRawData | GroupRawData
}

export interface RemoveSubtreeResult {
  elementId: string
  removed: readonly SubtreeRemovalEntry[]
}

export interface AddRemoveElementChange {
  action: SCENE_TREE_ACTIONS
  undoType: string
  undoAction: string
  eventName: string
  data: ElementRawData
  parentId?: string
  index?: number
  options?: MutationOptions
}

export interface MoveElementsChange {
  action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS
  eventName: string
  moves: HierarchyMove[]
  options?: MutationOptions
}

export interface SubtreeChange {
  action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE | SCENE_TREE_ACTIONS.RESTORE_SUBTREE
  undoAction:
    | SCENE_TREE_ACTIONS.REMOVE_SUBTREE
    | SCENE_TREE_ACTIONS.RESTORE_SUBTREE
  eventName: string
  elementId: string
  removed: SubtreeRemovalEntry[]
  options?: MutationOptions
}

export interface UpdateElementChange {
  action: SCENE_TREE_ACTIONS
  eventName: string
  id: string
  owner: SceneTreeDataOwner
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
    owner: SceneTreeDataOwner
    key: string
    before: DataTypes
    after: DataTypes
  }[]
  options?: MutationOptions
}

export type ComputedDataRecordValue = DataTypes | undefined

export interface ComputedDataRecordPatch {
  set?: Record<string, ComputedDataRecordValue>
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
          before?: ComputedDataRecordValue
          after: ComputedDataRecordValue
        }
      >
      remove?: Record<
        string,
        {
          before: ComputedDataRecordValue
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
  | MoveElementsChange
  | SubtreeChange
  | UpdateElementChange
  | UpdateElementBatchChange
  | UpdateElementPatchChange

export interface SceneTreeYjsChange extends YjsChange<SceneTreeChange> {}
