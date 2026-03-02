import BaseSelection from './base-selection'
import { SELECTION_ACTIONS, SELECTION_TYPES } from '@asyra/utils'

export default class ElementSelection extends BaseSelection {
  constructor() {
    super({
      selectionType: SELECTION_TYPES.ELEMENT,
      selectAction: SELECTION_ACTIONS.SELECT_ELEMENTS,
      eventName: 'selectElements'
    })
  }
}
