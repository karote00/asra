import {
  type AddElementEvent,
  changeComputedData,
  changeComputedDataBatch,
  changeComputedDataPatch,
  EventTypes,
  publishEventToObservers,
  sceneTreeInit,
  sceneTreeLoadData
} from '@asyra/reactive-events'
import {
  Bounds,
  ComputedDataPatch,
  CreateElementData,
  DataTypes,
  ElementRawData,
  EVENT_OPTIONS,
  GroupInstanceTypes,
  PropertyComponentRawData,
  SceneTreeRawData,
  EntityTypes,
  id,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult,
  SceneTreeRestorePlan,
  SceneTreeRestoreSnapshot
} from '@asyra/utils'
import { SceneTreeAPIs } from '../types'
import type { CanonicalElementBatchResult } from '../types/scene-tree'

export interface SceneTreeRequests {
  sceneTreeSaveData: () => SceneTreeRawData
  getElementComputedData: (
    elementId: string
  ) => Record<string, unknown> | undefined
  refreshComputedDataFromProperty: (
    elementId: string,
    propertyName: string,
    options?: EVENT_OPTIONS
  ) => void
  getAllElementsBounds: () => Bounds | null
  isContainerType: (type: string) => boolean
  moveElements: (
    request: MoveHierarchyRequest,
    options?: EVENT_OPTIONS
  ) => MoveHierarchyResult
  removeSubtree: (
    elementId: string,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  preflightRestoreSubtree: (
    snapshot: SceneTreeRestoreSnapshot
  ) => SceneTreeRestorePlan
  applyRestoreSubtree: (
    plan: SceneTreeRestorePlan,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
  createElements: (
    data: readonly CreateElementData[],
    parent?: GroupInstanceTypes,
    index?: number,
    options?: EVENT_OPTIONS
  ) => CanonicalElementBatchResult
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

  const requireSingleElementId = (
    expectedElementId: string,
    result: CanonicalElementBatchResult
  ): string => {
    if (result.orderedElementIds.length !== 1) {
      throw new Error(
        '[Core] Canonical batch-of-one requires exactly one ordered element id'
      )
    }
    const [elementId] = result.orderedElementIds
    if (elementId !== expectedElementId) {
      throw new Error(
        `[Core] Canonical batch-of-one expected canonical element id "${expectedElementId}"`
      )
    }
    return elementId
  }

  const executeCanonicalElementBatch = (
    prepared: readonly ReturnType<typeof prepareElementData>[],
    request: (
      data: readonly CreateElementData[]
    ) => CanonicalElementBatchResult,
    createCompatibilityPayload: (
      data: CreateElementData
    ) => AddElementEvent['payload'],
    options?: EVENT_OPTIONS
  ): CanonicalElementBatchResult => {
    const result = request(prepared.map(({ data: elementData }) => elementData))
    if (prepared.length === 1) {
      const [single] = prepared
      requireSingleElementId(single.elementId, result)
      publishEventToObservers({
        type: EventTypes.ADD_ELEMENT,
        payload: createCompatibilityPayload(single.data),
        options
      })
    }
    return result
  }

  const createElementsInParentBatch = (
    data: readonly CreateElementData[],
    parentId: string,
    index?: number,
    options?: EVENT_OPTIONS
  ): CanonicalElementBatchResult => {
    if (data.length === 0) {
      throw new Error(
        '[Core] Canonical element batch requires at least one element'
      )
    }
    const prepared = data.map(prepareElementData)
    return executeCanonicalElementBatch(
      prepared,
      (elementData) =>
        sceneTreeRequests.createElementsInParentBatch(
          elementData,
          parentId,
          index,
          options
        ),
      (elementData) => ({
        data: elementData,
        parentId,
        index
      }),
      options
    )
  }

  return {
    createElement(
      data: CreateElementData,
      parent?: GroupInstanceTypes,
      index?: number,
      options?: EVENT_OPTIONS
    ) {
      const prepared = prepareElementData(data)
      const result = executeCanonicalElementBatch(
        [prepared],
        (elementData) =>
          sceneTreeRequests.createElements(elementData, parent, index, options),
        (elementData) => ({
          data: elementData,
          parent,
          index
        }),
        options
      )
      return requireSingleElementId(prepared.elementId, result)
    },
    createElementInParent(
      data: CreateElementData,
      parentId: string,
      index?: number,
      options?: EVENT_OPTIONS
    ) {
      const prepared = prepareElementData(data)
      const result = executeCanonicalElementBatch(
        [prepared],
        (elementData) =>
          sceneTreeRequests.createElementsInParentBatch(
            elementData,
            parentId,
            index,
            options
          ),
        (elementData) => ({
          data: elementData,
          parentId,
          index
        }),
        options
      )
      return requireSingleElementId(prepared.elementId, result)
    },
    createElementsInParentBatch,
    createElementsInParent(
      data: readonly CreateElementData[],
      parentId: string,
      index?: number,
      options?: EVENT_OPTIONS
    ) {
      if (data.length === 0) {
        return []
      }
      return createElementsInParentBatch(data, parentId, index, options)
        .orderedElementIds
    },
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
        return []
      }
      return sceneTreeRequests.createElementsInParentFromCanonicalData(
        elements,
        properties,
        parentId,
        index,
        options
      )
    },
    createElementsInParentFromCanonicalDataUsingActiveProperties(
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
        return []
      }
      return sceneTreeRequests.createElementsInParentFromCanonicalDataUsingActiveProperties(
        elements,
        properties,
        parentId,
        index,
        options
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
    removeSubtree(elementId: string, options?: EVENT_OPTIONS) {
      return sceneTreeRequests.removeSubtree(elementId, options)
    },
    preflightRestoreSubtree(snapshot: SceneTreeRestoreSnapshot) {
      return sceneTreeRequests.preflightRestoreSubtree(snapshot)
    },
    applyRestoreSubtree(plan: SceneTreeRestorePlan, options?: EVENT_OPTIONS) {
      return sceneTreeRequests.applyRestoreSubtree(plan, options)
    },
    getAllElementsBounds() {
      return sceneTreeRequests.getAllElementsBounds()
    },
    changeComputedData(
      elementIds: string[],
      data: Record<string, DataTypes>,
      options?: EVENT_OPTIONS
    ) {
      const entries = Object.entries(data ?? {})
      if (entries.length === 0) {
        return
      }

      if (options?.undoable === false && entries.length > 1) {
        changeComputedDataBatch(elementIds, data, options)
        return
      }

      entries.forEach(([key, value]) => {
        changeComputedData(elementIds, key, value, options)
      })
    },
    changeComputedDataPatch(
      elementIds: string[],
      patch: ComputedDataPatch,
      options?: EVENT_OPTIONS
    ) {
      const hasValues = Object.keys(patch.values ?? {}).length > 0
      const hasRecords = Object.values(patch.records ?? {}).some(
        (recordPatch) =>
          Object.keys(recordPatch.set ?? {}).length > 0 ||
          (recordPatch.remove?.length ?? 0) > 0
      )
      if (!hasValues && !hasRecords) {
        return
      }

      changeComputedDataPatch(elementIds, patch, options)
    },
    refreshComputedDataFromProperty(
      elementId: string,
      propertyName: string,
      options?: EVENT_OPTIONS
    ) {
      sceneTreeRequests.refreshComputedDataFromProperty(
        elementId,
        propertyName,
        options
      )
    },
    isContainerType(type: string) {
      return sceneTreeRequests.isContainerType(type)
    }
  }
}
