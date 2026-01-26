import { SELECTION_TYPES } from '@asyra/utils'
import SelectionManager from './selection-manager'
import { elementSelection } from './selections/element-selection'
import { vertexSelection } from './selections/vertex-selection'
import { initSelectionSubscribes } from './subscribes'

initSelectionSubscribes()

const selectionManager = new SelectionManager()
selectionManager.register(SELECTION_TYPES.ELEMENT, elementSelection)
selectionManager.register(SELECTION_TYPES.VERTEX, vertexSelection)

export { SelectionManager }
export default selectionManager
