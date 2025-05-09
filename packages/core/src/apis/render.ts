import {
  endTransaction,
  addRectangle,
  selectElements,
  startTransaction,
  initRender
} from '@asra/reactive-events'
import { CreateRectangleData } from '@asra/utils'
import { RenderAPIs } from '../types/core-apis'

export const createRenderAPIs = (): RenderAPIs => {
  return {
    async initRender(width: number, height: number, color: number) {
      return await initRender(width, height, color)
    },
    async addRectangle(data: CreateRectangleData) {
      startTransaction()
      const newElementId = await addRectangle(data)
      selectElements([newElementId])
      endTransaction()
    }
  }
}
