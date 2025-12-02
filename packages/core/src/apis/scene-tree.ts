import {
  endTransaction,
  addRectangle,
  selectElements,
  startTransaction,
  sceneTreeLoadComplete,
  requestElementSelection,
  changeComputedData,
  sceneTreeInit,
  sceneTreeLoadData,
  sceneTreeSaveData
} from '@asra/reactive-events'
import {
  CreateRectangleData,
  SceneTreeRawData,
  DataTypes,
  PositionData,
  DimensionData
} from '@asra/utils'
import { SceneTreeAPIs } from '../types'

export const createSceneTreeAPIs = (): SceneTreeAPIs => {
  return {
    sceneTreeInit() {
      sceneTreeInit()
      sceneTreeLoadComplete()
    },
    sceneTreeLoadData(data: SceneTreeRawData) {
      sceneTreeLoadData(data)
      sceneTreeLoadComplete()
    },
    async sceneTreeSaveData() {
      return await sceneTreeSaveData()
    },
    async addRectangle(data: CreateRectangleData) {
      startTransaction()
      const newElementId = await addRectangle(data)
      selectElements([newElementId])
      endTransaction()
    },
    async changeComputedData(key: string, data: DataTypes) {
      startTransaction()
      const elementIds = await requestElementSelection()
      changeComputedData(elementIds, key, data)
      endTransaction()
    },
    async resizeElement(pos: PositionData, dimension: DimensionData, option) {
      startTransaction()
      const elementIds = await requestElementSelection()
      changeComputedData(elementIds, 'x', pos.x, option)
      changeComputedData(elementIds, 'y', pos.y, option)
      changeComputedData(elementIds, 'width', dimension.width, option)
      changeComputedData(elementIds, 'height', dimension.height, option)
      endTransaction()
    }
  }
}
