import {
  Bounds,
  ComputedDataPatch,
  CreateElementData,
  ElementRawData,
  GroupInstanceTypes,
  SceneTreeRawData,
  DataTypes,
  EVENT_OPTIONS,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult,
  PropertyComponentRawData,
  SceneTreeRestorePlan,
  SceneTreeRestoreSnapshot
} from '@asyra/utils'
import type { FactoryMutationBatchDeliveryHandle } from '@asyra/factory'
import type { CanonicalElementRemoval } from '@asyra/scene-tree'

export interface CanonicalElementBatchTimingArtifact {
  readonly owner: '@asyra/core'
  readonly clock: 'monotonic'
  readonly startedAtMs: number
  readonly completedAtMs: number
  readonly durationMs: number
}

export interface CanonicalElementBatchResult {
  readonly orderedElementIds: readonly string[]
  readonly deliveryHandle: FactoryMutationBatchDeliveryHandle
  readonly timing: CanonicalElementBatchTimingArtifact
}

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
  createElementsInParentBatch: (
    data: readonly CreateElementData[],
    parentId: string,
    index?: number,
    options?: EVENT_OPTIONS
  ) => CanonicalElementBatchResult
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
  createElementsInParentFromCanonicalDataUsingActiveProperties: (
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
  removeSubtree: (
    elementId: string,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  removeSubtreeUsingActiveProperties: (
    elementId: string,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  removeElementUsingActiveProperties: (
    removal: CanonicalElementRemoval,
    options?: EVENT_OPTIONS
  ) => boolean
  removeElementsUsingActiveProperties: (
    removals: readonly CanonicalElementRemoval[],
    options?: EVENT_OPTIONS
  ) => readonly string[]
  preflightRestoreSubtree: (
    snapshot: SceneTreeRestoreSnapshot
  ) => SceneTreeRestorePlan
  applyRestoreSubtree: (
    plan: SceneTreeRestorePlan,
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
