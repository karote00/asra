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
  GroupInstanceTypes,
  SceneTreeRawData,
  EntityTypes,
  id
} from '@asyra/utils'
import { SceneTreeAPIs } from '../types'

export interface SceneTreeRequests {
  sceneTreeSaveData: () => SceneTreeRawData
  getAllElementsBounds: () => Bounds | null
}

export const createSceneTreeAPIs = (
  sceneTreeRequests: SceneTreeRequests
): SceneTreeAPIs => {
  return {
    createElement(
      data: CreateElementData,
      parent?: GroupInstanceTypes,
      index?: number
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
        parent
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
    changeComputedData(elementIds: string[], data: Record<string, DataTypes>) {
      const entries = Object.entries(data ?? {})
      if (entries.length === 0) {
        return
      }

      entries.forEach(([key, value]) => {
        changeComputedData(elementIds, key, value)
      })
    }
  }
}
