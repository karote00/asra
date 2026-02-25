import {
  endTransaction,
  selectElements,
  startTransaction
} from '@asyra/reactive-events'
import { EVENT_OPTIONS } from '@asyra/utils'
import { ElementSelectionActionAPIs } from '../types'

export const createElementSelectionAPIs = (): ElementSelectionActionAPIs => {
  return {
    selectElements(elementIds: string[], options?: EVENT_OPTIONS) {
      startTransaction()
      selectElements(elementIds, options)
      endTransaction()
    }
  }
}
