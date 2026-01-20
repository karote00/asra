import {
  endTransaction,
  selectElements,
  startTransaction,
  sceneTreeLoadComplete,
  requestElementSelection,
  changeComputedData,
  sceneTreeInit,
  sceneTreeLoadData
} from '@asra/reactive-events'
import {
  ElementRawData,
  SceneTreeRawData,
  DataTypes,
  PositionData,
  DimensionData,
  EVENT_OPTIONS
} from '@asra/utils'
import { SceneTreeAPIs, SceneTreeRequests, FactoryRequests } from '../types'

export const createSceneTreeAPIs = (
  sceneTreeRequests: SceneTreeRequests,
  factoryRequests: FactoryRequests
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
    addRectangle(data: ElementRawData) {
      startTransaction()
      const inUndoRedo = factoryRequests.isInUndoRedo()
      const newElementId = sceneTreeRequests.addRectangle(data, inUndoRedo)
      selectElements([newElementId])
      endTransaction()
    },
    async changeComputedData(key: string, data: DataTypes) {
      startTransaction()
      const elementIds = await requestElementSelection()
      changeComputedData(elementIds, key, data)
      endTransaction()
    },
    async resizeElement(
      pos: PositionData,
      dimension: DimensionData,
      options?: EVENT_OPTIONS
    ) {
      startTransaction()
      const elementIds = await requestElementSelection()
      changeComputedData(elementIds, 'x', pos.x, options)
      changeComputedData(elementIds, 'y', pos.y, options)
      changeComputedData(elementIds, 'width', dimension.width, options)
      changeComputedData(elementIds, 'height', dimension.height, options)
      endTransaction()
    }
  }
}
