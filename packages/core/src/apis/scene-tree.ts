import {
  addElement,
  changeComputedData,
  changeComputedDataBatch,
  changeComputedDataPatch,
  sceneTreeInit,
  sceneTreeLoadData
} from '@asyra/reactive-events'
import {
  Bounds,
  ComputedDataPatch,
  CreateElementData,
  DataTypes,
  EVENT_OPTIONS,
  GroupInstanceTypes,
  SceneTreeRawData,
  EntityTypes,
  id,
  MoveHierarchyRequest,
  MoveHierarchyResult,
  RemoveSubtreeResult
} from '@asyra/utils'
import { SceneTreeAPIs } from '../types'

export interface SceneTreeRequests {
  sceneTreeSaveData: () => SceneTreeRawData
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
}

export const createSceneTreeAPIs = (
  sceneTreeRequests: SceneTreeRequests
): SceneTreeAPIs => {
  return {
    createElement(
      data: CreateElementData,
      parent?: GroupInstanceTypes,
      index?: number,
      options?: EVENT_OPTIONS
    ) {
      const elementType = data.type ?? EntityTypes.ELEMENT
      const elementId = data.id ?? id(elementType)

      addElement(
        {
          visible: true,
          lock: false,
          ...data,
          id: elementId
        },
        index,
        parent,
        options
      )

      return elementId
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
