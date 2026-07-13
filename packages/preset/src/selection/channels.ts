import { EventTypes } from '@asyra/core'

export const SelectionChannels = {
  ELEMENT: 'element',
  VECTOR_POINT: 'vectorPoint',
  VECTOR_SEGMENT: 'vectorSegment'
} as const

export type SelectionChannel =
  (typeof SelectionChannels)[keyof typeof SelectionChannels]

export const SelectionChannelList: SelectionChannel[] = [
  SelectionChannels.ELEMENT,
  SelectionChannels.VECTOR_POINT,
  SelectionChannels.VECTOR_SEGMENT
]

export const SelectionActions = {
  SELECT_ELEMENTS: 'selectElements',
  DESELECT_ELEMENTS: 'deselectElements',
  SELECT_VECTOR_POINTS: 'selectVectorPoints',
  DESELECT_VECTOR_POINTS: 'deselectVectorPoints',
  SELECT_VECTOR_SEGMENTS: 'selectVectorSegments',
  DESELECT_VECTOR_SEGMENTS: 'deselectVectorSegments'
} as const

export type SelectionAction =
  (typeof SelectionActions)[keyof typeof SelectionActions]

export const SelectionEventNames = {
  SELECT_ELEMENTS: EventTypes.SELECT_ELEMENTS,
  SELECT_VECTOR_POINTS: EventTypes.SELECT_VECTOR_POINTS,
  SELECT_VECTOR_SEGMENTS: EventTypes.SELECT_VECTOR_SEGMENTS
} as const

export type SelectionEventName =
  (typeof SelectionEventNames)[keyof typeof SelectionEventNames]
