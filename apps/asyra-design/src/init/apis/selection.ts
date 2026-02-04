import { SELECTION_TYPES } from '@asyra/utils'
import { startTransaction, endTransaction } from '../events'
import { selection } from '../../contexts'

export const selectionApis = {
  selectElements: (elementIds: string[]) => {
    startTransaction()
    const elementSelection = selection.get(SELECTION_TYPES.ELEMENT)
    if (elementSelection) {
      elementSelection.select(elementIds)
    }
    endTransaction()
  }
}
