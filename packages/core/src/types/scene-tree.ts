import {
  Bounds,
  CreateElementData,
  ElementRawData,
  GroupInstanceTypes,
  HierarchyMove,
  SceneTreeRawData,
  EVENT_OPTIONS,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult,
  PropertyComponentRawData,
  PreparedSceneTreeRestore,
  SceneTreeRestorePreflightOptions,
  SceneTreeRestoreSnapshot,
  SubtreeChange,
  UpdateElementDataChange
} from '@asyra/utils'
import type {
  CanonicalElementRemoval,
  LocalComputedDataPatchUpdate,
  LocalComputedDataUpdate
} from '@asyra/scene-tree'

export interface SceneTreeRawAPIs {
  sceneTreeInit: () => void
  sceneTreeLoadData: (data: SceneTreeRawData) => void
  sceneTreeSaveData: () => SceneTreeRawData
  createElement: (
    data: CreateElementData,
    parent?: GroupInstanceTypes,
    index?: number,
    options?: EVENT_OPTIONS
  ) => string
  createElementInParent: (
    data: CreateElementData,
    parentId: string,
    index?: number,
    options?: EVENT_OPTIONS
  ) => string
  createElementsInParent: (
    data: readonly CreateElementData[],
    parentId: string,
    index?: number,
    options?: EVENT_OPTIONS
  ) => readonly string[]
  createElementsInParentFromCanonicalData: (
    elements: readonly ElementRawData[],
    properties: readonly PropertyComponentRawData[],
    parentId: string,
    index?: number,
    options?: EVENT_OPTIONS
  ) => readonly string[]
  getElementComputedData: (
    elementId: string
  ) => Record<string, unknown> | undefined
  moveElements: (
    request: MoveHierarchyRequest,
    options?: EVENT_OPTIONS
  ) => MoveHierarchyResult
  applyHierarchyMoves: (
    moves: readonly HierarchyMove[],
    options?: EVENT_OPTIONS
  ) => boolean
  applyElementDataChanges: (
    changes: readonly UpdateElementDataChange[],
    options?: EVENT_OPTIONS
  ) => readonly string[]
  removeSubtree: (
    elementId: string,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  removeSubtreeFromCanonicalData: (
    change: SubtreeChange,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  removeElementsFromCanonicalData: (
    removals: readonly CanonicalElementRemoval[],
    options?: EVENT_OPTIONS
  ) => readonly string[]
  preflightRestoreSubtree: (
    snapshot: SceneTreeRestoreSnapshot,
    options?: SceneTreeRestorePreflightOptions
  ) => PreparedSceneTreeRestore
  applyRestoreSubtree: (
    preparedRestore: PreparedSceneTreeRestore,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  updateLocalComputedData: (updates: readonly LocalComputedDataUpdate[]) => void
  patchLocalComputedData: (
    updates: readonly LocalComputedDataPatchUpdate[]
  ) => void
  projectLocalComputedDataFromPropertyIds: (
    propertyIds: readonly string[]
  ) => void
  getAllElementsBounds: () => Bounds | null
  isContainerType: (type: string) => boolean
}

export type SceneTreeAPIs = SceneTreeRawAPIs
