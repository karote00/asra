import {
  endTransaction,
  selectElements,
  startTransaction
} from '@asra/reactive-events'
import { ElementSelectionAPIs } from '../types/core-apis'

export const createElementSelectionAPIs = (): ElementSelectionAPIs => {
  return {
    selectElements(elementIds: string[]) {
      startTransaction()
      selectElements(elementIds)
      endTransaction()
    }
  }
}
