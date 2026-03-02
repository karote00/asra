import { SELECTION_ACTIONS, SELECTION_TYPES } from '@asyra/utils'
import BaseSelection from './base-selection'

export default class VectorPointSelection extends BaseSelection {
  constructor() {
    super({
      selectionType: SELECTION_TYPES.VECTOR_POINT,
      selectAction: SELECTION_ACTIONS.SELECT_VECTOR_POINTS,
      eventName: 'selectVectorPoints'
    })
  }
}
