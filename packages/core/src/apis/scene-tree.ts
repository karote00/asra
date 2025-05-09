import {
  endTransaction,
  addRectangle,
  selectElements,
  startTransaction
} from '@asra/reactive-events'
import { CreateRectangleData } from '@asra/utils'
import { SceneTreeAPIs } from '../types/core-apis'

export const createSceneTreeAPIs = (): SceneTreeAPIs => {
  return {
    async addRectangle(data: CreateRectangleData) {
      startTransaction()
      const newElementId = await addRectangle(data)
      selectElements([newElementId])
      endTransaction()
    }
  }
}
