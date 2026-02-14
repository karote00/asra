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
  IDTypes,
  NameTypes,
  SceneTreeRawData,
  EntityTypes,
  id,
  name
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
      const elementId = data.id ?? id(IDTypes.ELEMENT)
      const elementType = data.type ?? EntityTypes.ELEMENT
      const nameType = resolveNameType(elementType)

      addElement(
        {
          visible: true,
          lock: false,
          ...data,
          id: elementId,
          name: data.name ?? name(nameType)
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

const resolveNameType = (type: EntityTypes): NameTypes => {
  switch (type) {
    case EntityTypes.FRAME:
      return NameTypes.FRAME
    case EntityTypes.GROUP:
      return NameTypes.GROUP
    case EntityTypes.RECTANGLE:
      return NameTypes.RECTANGLE
    case EntityTypes.WORKSPACE:
      return NameTypes.WORKSPACE
    default:
      return NameTypes.ELEMENT
  }
}
