import {
  Bounds,
  ComputedDataPatch,
  CreateElementData,
  GroupInstanceTypes,
  SceneTreeRawData,
  DataTypes,
  EVENT_OPTIONS,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult
} from '@asyra/utils'

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
  moveElements: (
    request: MoveHierarchyRequest,
    options?: EVENT_OPTIONS
  ) => MoveHierarchyResult
  removeSubtree: (
    elementId: string,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  changeComputedData: (
    elementIds: string[],
    data: Record<string, DataTypes>,
    options?: EVENT_OPTIONS
  ) => void
  changeComputedDataPatch: (
    elementIds: string[],
    patch: ComputedDataPatch,
    options?: EVENT_OPTIONS
  ) => void
  refreshComputedDataFromProperty: (
    elementId: string,
    propertyName: string,
    options?: EVENT_OPTIONS
  ) => void
  getAllElementsBounds: () => Bounds | null
  isContainerType: (type: string) => boolean
}

export type SceneTreeAPIs = SceneTreeRawAPIs
