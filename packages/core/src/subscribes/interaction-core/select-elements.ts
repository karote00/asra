import { subscribeToDecideToSelectElements } from '@asyra/reactive-events'
import { ElementSelectionActionAPIs } from '../../types'

export const initSelectElementHandlers = (apis: ElementSelectionActionAPIs) => {
  subscribeToDecideToSelectElements(({ payload }) => {
    apis.selectElements(payload.elementIds)
  })
}
