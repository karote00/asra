import SelectionManager from './selection-manager'
import ElementSelection from './selections/element-selection'
import VertexSelection from './selections/vertex-selection'
import { initSelectionSubscribes } from './subscribes'
import selectionManager from './selection-manager-instance'

initSelectionSubscribes()

export { SelectionManager, ElementSelection, VertexSelection }
export default selectionManager
