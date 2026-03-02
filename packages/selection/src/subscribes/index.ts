import { initElementSelectionSubscribes } from './element-selection'
import { initVectorPointSelectionSubscribes } from './vector-point-selection'
import { initVectorSegmentSelectionSubscribes } from './vector-segment-selection'

export const initSelectionSubscribes = () => {
  initElementSelectionSubscribes()
  initVectorPointSelectionSubscribes()
  initVectorSegmentSelectionSubscribes()
}
