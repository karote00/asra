import {
  endTransaction,
  selectElements,
  startTransaction,
  sceneTreeLoadComplete,
  changeComputedData,
  sceneTreeInit,
  sceneTreeLoadData
} from '@asra/reactive-events'
import {
  SceneTreeRawData,
  DataTypes,
  PositionData,
  DimensionData,
  EVENT_OPTIONS,
  CreateElementData
} from '@asra/utils'
import {
  SceneTreeAPIs,
  SceneTreeRequests,
  FactoryRequests,
  SelectionRequests
} from '../types'

export const createSceneTreeAPIs = (
  sceneTreeRequests: SceneTreeRequests,
  factoryRequests: FactoryRequests,
  selectionRequests: SelectionRequests
): SceneTreeAPIs => {
  return {
    sceneTreeInit() {
      sceneTreeInit()
      sceneTreeLoadComplete()
    },
    sceneTreeLoadData(data: SceneTreeRawData) {
      sceneTreeLoadData(data)
      sceneTreeLoadComplete()
    },
    sceneTreeSaveData() {
      return sceneTreeRequests.sceneTreeSaveData()
    },
    addRectangle(data: CreateElementData) {
      startTransaction()
      const inUndoRedo = factoryRequests.isInUndoRedo()
      const newElementId = sceneTreeRequests.addRectangle(data, inUndoRedo)
      selectElements([newElementId])
      endTransaction()
    },
    changeComputedData(key: string, data: DataTypes) {
      startTransaction()
      const elementIds = selectionRequests.getElementSelectionIds()
      changeComputedData(elementIds, key, data)
      endTransaction()
    },
    resizeElement(
      pos: PositionData,
      dimension: DimensionData,
      options?: EVENT_OPTIONS
    ) {
      startTransaction()
      const elementIds = selectionRequests.getElementSelectionIds()
      changeComputedData(elementIds, 'x', pos.x, options)
      changeComputedData(elementIds, 'y', pos.y, options)
      changeComputedData(elementIds, 'width', dimension.width, options)
      changeComputedData(elementIds, 'height', dimension.height, options)
      endTransaction()
    }
  }
}
