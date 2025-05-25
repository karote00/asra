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
import { CreateRectangleData, SceneTreeRawData, DataTypes } from '@asra/utils'
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
    }
  }
}
