import { SELECTION_ACTIONS, SELECTION_TYPES } from '@asyra/utils'
import BaseSelection from './base-selection'

export default class VectorSegmentSelection extends BaseSelection {
  constructor() {
    super({
      selectionType: SELECTION_TYPES.VECTOR_SEGMENT,
      selectAction: SELECTION_ACTIONS.SELECT_VECTOR_SEGMENTS,
      eventName: 'selectVectorSegments'
    })
  }
}
