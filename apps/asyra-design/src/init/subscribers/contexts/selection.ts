import { selection } from '../../../contexts'
import { SELECTION_TYPES } from '@asyra/utils'
import { subscribeToDecideToSelectElements } from '../../events'
import { factoryApis } from '../../apis'

export const initElementSelectionSubscribes = () => {
  subscribeToDecideToSelectElements((payload) => {
    const elementSelection = selection.get(SELECTION_TYPES.ELEMENT)
    if (!elementSelection) {
      return
    }

    elementSelection.select((payload as unknown as { elementIds: string[] }).elementIds)

    elementSelection.changes.forEach((change) => {
      // console.log(change)
      factoryApis.updateTransaction({
        eventName: change.eventName,
        payload: change
      })
    })
    elementSelection.cleanChanges()
  })
}
