import {
  endTransaction,
  selectElements,
  startTransaction
} from '@asra/reactive-events'
import { ElementSelectionActionAPIs } from '../types'

export const createElementSelectionAPIs = (): ElementSelectionActionAPIs => {
  return {
    selectElements(elementIds: string[]) {
      startTransaction()
      selectElements(elementIds)
      endTransaction()
    }
  }
}
