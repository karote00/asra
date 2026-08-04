import { publishEvent } from '../event-bus.js'
import { EventTypes } from '../types.js'
import type { EVENT_OPTIONS } from '@asyra/utils'

export const selectElements = (
  elementIds: string[],
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.SELECT_ELEMENTS,
    payload: {
      after: elementIds
    },
    options
  })
}

export const selectVectorPoints = (
  pointIds: string[],
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.SELECT_VECTOR_POINTS,
    payload: {
      after: pointIds
    },
    options
  })
}

export const selectVectorSegments = (
  segmentIds: string[],
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.SELECT_VECTOR_SEGMENTS,
    payload: {
      after: segmentIds
    },
    options
  })
}
