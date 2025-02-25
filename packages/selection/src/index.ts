import SelectionManager from './selection-manager'
import { elementSelection } from './selections/element-selection'
import { vertexSelection } from './selections/vertex-selection'
import { initSelectionSubscribes } from './subscribes'

initSelectionSubscribes()

const selectionManager = new SelectionManager()
selectionManager.register('element', elementSelection)
selectionManager.register('vertex', vertexSelection)

export { SelectionManager }
export default selectionManager
