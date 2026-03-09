import {
  addElement,
  changeComputedData,
  sceneTreeInit,
  sceneTreeLoadData
} from '@asyra/reactive-events'
import {
  Bounds,
  CreateElementData,
  DataTypes,
  EVENT_OPTIONS,
  GroupInstanceTypes,
  SceneTreeRawData,
  EntityTypes,
  id
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

      entries.forEach(([key, value]) => {
        changeComputedData(elementIds, key, value, options)
      })
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
