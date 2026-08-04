import type {
  SelectElementsEvent,
  SelectVectorPointsEvent,
  SelectVectorSegmentsEvent
} from './events.js'
import { createSubscribeEvent } from '../event-bus.js'
import { EventTypes } from '../types.js'

export const subscribeToSelectElements =
  createSubscribeEvent<SelectElementsEvent>(EventTypes.SELECT_ELEMENTS)

export const subscribeToSelectVectorPoints =
  createSubscribeEvent<SelectVectorPointsEvent>(EventTypes.SELECT_VECTOR_POINTS)

export const subscribeToSelectVectorSegments =
  createSubscribeEvent<SelectVectorSegmentsEvent>(
    EventTypes.SELECT_VECTOR_SEGMENTS
  )
