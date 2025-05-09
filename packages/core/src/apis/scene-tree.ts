import {
  endTransaction,
  addRectangle,
  selectElements,
  startTransaction,
  sceneTreeLoadComplete,
  requestElementSelection,
  changeComputedData
} from '@asra/reactive-events'
import { CreateRectangleData, SceneTreeRawData, DataTypes } from '@asra/utils'
import { APIDeps, SceneTreeAPIs } from '../types'

export const createSceneTreeAPIs = (
  sceneTree: APIDeps['sceneTree']
): SceneTreeAPIs => {
  return {
    initSceneTree() {
      sceneTree.init()
      sceneTreeLoadComplete()
    },
    loadSceneTree(data: SceneTreeRawData) {
      sceneTree.load(data)
      sceneTreeLoadComplete()
    },
    saveSceneTree() {
      return sceneTree.save()
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
