import {
  endTransaction,
  selectElements,
  selectVectorPoints,
  selectVectorSegments,
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
    },
    selectVectorPoints(pointIds: string[], options?: EVENT_OPTIONS) {
      startTransaction()
      selectVectorPoints(pointIds, options)
      endTransaction()
    },
    selectVectorSegments(segmentIds: string[], options?: EVENT_OPTIONS) {
      startTransaction()
      selectVectorSegments(segmentIds, options)
      endTransaction()
    }
  }
}
