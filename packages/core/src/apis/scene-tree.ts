import { sceneTreeInit, sceneTreeLoadData } from '@asyra/reactive-events'
import {
  Bounds,
  CreateElementData,
  ElementRawData,
  EVENT_OPTIONS,
  GroupInstanceTypes,
  HierarchyMove,
  PropertyComponentRawData,
  SceneTreeRawData,
  EntityTypes,
  id,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult,
  PreparedSceneTreeRestore,
  SceneTreeRestorePreflightOptions,
  SceneTreeRestoreSnapshot,
  SubtreeChange,
  UpdateElementDataChange
} from '@asyra/utils'
import { SceneTreeAPIs } from '../types/index.js'
import type {
  CanonicalElementRemoval,
  LocalComputedDataPatchUpdate,
  LocalComputedDataUpdate
} from '@asyra/scene-tree'

export interface SceneTreeRequests {
  sceneTreeSaveData: () => SceneTreeRawData
  getCurrentWorkspaceId: () => string
  getElementComputedData: (
    elementId: string
  ) => Record<string, unknown> | undefined
  updateLocalComputedData: (updates: readonly LocalComputedDataUpdate[]) => void
  patchLocalComputedData: (
    updates: readonly LocalComputedDataPatchUpdate[]
  ) => void
  projectLocalComputedDataFromPropertyIds: (
    propertyIds: readonly string[]
  ) => void
  getAllElementsBounds: () => Bounds | null
  isContainerType: (type: string) => boolean
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
}

export const createSceneTreeAPIs = (
  sceneTreeRequests: SceneTreeRequests
): SceneTreeAPIs => {
  const prepareElementData = (data: CreateElementData) => {
    const elementType = data.type ?? EntityTypes.ELEMENT
    const elementId = data.id ?? id(elementType)

    return {
      elementId,
      data: {
        visible: true,
        lock: false,
        ...data,
        id: elementId
      }
    }
  }

  const freezeOrderedElementIds = (
    elementIds: readonly string[]
  ): readonly string[] => Object.freeze([...elementIds])

  const requireSingleElementId = (elementIds: readonly string[]): string => {
    if (elementIds.length !== 1) {
      throw new Error(
        '[Core] Canonical batch-of-one requires exactly one ordered element id'
      )
    }
    const [elementId] = elementIds
    return elementId
  }

  const createElementsInParent = (
    data: readonly CreateElementData[],
    parentId: string,
    index?: number,
    options?: EVENT_OPTIONS
  ): readonly string[] => {
    if (data.length === 0) {
      return Object.freeze([])
    }
    const prepared = data.map(prepareElementData)
    return freezeOrderedElementIds(
      sceneTreeRequests.createElementsInParent(
        prepared.map(({ data: elementData }) => elementData),
        parentId,
        index,
        options
      )
    )
  }

  return {
    createElement(
      data: CreateElementData,
      parent?: GroupInstanceTypes,
      index?: number,
      options?: EVENT_OPTIONS
    ) {
      const parentId =
        parent?.get('id') ?? sceneTreeRequests.getCurrentWorkspaceId()
      return requireSingleElementId(
        createElementsInParent([data], parentId, index, options)
      )
    },
    createElementInParent(
      data: CreateElementData,
      parentId: string,
      index?: number,
      options?: EVENT_OPTIONS
    ) {
      return requireSingleElementId(
        createElementsInParent([data], parentId, index, options)
      )
    },
    createElementsInParent,
    createElementsInParentFromCanonicalData(
      elements: readonly ElementRawData[],
      properties: readonly PropertyComponentRawData[],
      parentId: string,
      index?: number,
      options?: EVENT_OPTIONS
    ) {
      if (elements.length === 0) {
        if (properties.length > 0) {
          throw new Error(
            '[Core] Canonical element batch cannot contain orphan properties'
          )
        }
        return freezeOrderedElementIds([])
      }
      return freezeOrderedElementIds(
        sceneTreeRequests.createElementsInParentFromCanonicalData(
          elements,
          properties,
          parentId,
          index,
          options
        )
      )
    },
    getElementComputedData(elementId: string) {
      const data = sceneTreeRequests.getElementComputedData(elementId)
      if (!data) {
        return undefined
      }
      if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(data)
      }
      return JSON.parse(JSON.stringify(data)) as Record<string, unknown>
    },
    sceneTreeInit() {
      sceneTreeInit()
    },
    sceneTreeLoadData(data: SceneTreeRawData) {
      sceneTreeLoadData(data)
    },
    sceneTreeSaveData() {
      return sceneTreeRequests.sceneTreeSaveData()
    },
    moveElements(request: MoveHierarchyRequest, options?: EVENT_OPTIONS) {
      return sceneTreeRequests.moveElements(request, options)
    },
    applyHierarchyMoves(
      moves: readonly HierarchyMove[],
      options?: EVENT_OPTIONS
    ) {
      if (moves.length === 0) {
        return false
      }
      return sceneTreeRequests.applyHierarchyMoves(moves, options)
    },
    applyElementDataChanges(
      changes: readonly UpdateElementDataChange[],
      options?: EVENT_OPTIONS
    ) {
      if (changes.length === 0) {
        return freezeOrderedElementIds([])
      }
      return freezeOrderedElementIds(
        sceneTreeRequests.applyElementDataChanges(changes, options)
      )
    },
    removeSubtree(elementId: string, options?: EVENT_OPTIONS) {
      return sceneTreeRequests.removeSubtree(elementId, options)
    },
    removeSubtreeFromCanonicalData(
      change: SubtreeChange,
      options?: EVENT_OPTIONS
    ) {
      return sceneTreeRequests.removeSubtreeFromCanonicalData(change, options)
    },
    removeElementsFromCanonicalData(
      removals: readonly CanonicalElementRemoval[],
      options?: EVENT_OPTIONS
    ) {
      if (removals.length === 0) {
        return Object.freeze([])
      }
      return freezeOrderedElementIds(
        sceneTreeRequests.removeElementsFromCanonicalData(removals, options)
      )
    },
    preflightRestoreSubtree(
      snapshot: SceneTreeRestoreSnapshot,
      options?: SceneTreeRestorePreflightOptions
    ) {
      return options === undefined
        ? sceneTreeRequests.preflightRestoreSubtree(snapshot)
        : sceneTreeRequests.preflightRestoreSubtree(snapshot, options)
    },
    applyRestoreSubtree(
      preparedRestore: PreparedSceneTreeRestore,
      options?: EVENT_OPTIONS
    ) {
      return sceneTreeRequests.applyRestoreSubtree(preparedRestore, options)
    },
    getAllElementsBounds() {
      return sceneTreeRequests.getAllElementsBounds()
    },
    updateLocalComputedData(updates: readonly LocalComputedDataUpdate[]) {
      if (updates.length === 0) {
        return
      }
      sceneTreeRequests.updateLocalComputedData(updates)
    },
    patchLocalComputedData(updates: readonly LocalComputedDataPatchUpdate[]) {
      if (updates.length === 0) {
        return
      }
      sceneTreeRequests.patchLocalComputedData(updates)
    },
    projectLocalComputedDataFromPropertyIds(propertyIds: readonly string[]) {
      if (propertyIds.length === 0) {
        return
      }
      sceneTreeRequests.projectLocalComputedDataFromPropertyIds(propertyIds)
    },
    isContainerType(type: string) {
      return sceneTreeRequests.isContainerType(type)
    }
  }
}
