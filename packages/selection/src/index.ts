import SelectionManager from './selection-manager'
import ElementSelection from './element-selection'
import VertexSelection from './vertex-selection'

const selectionManager = new SelectionManager()
selectionManager.register('element', new ElementSelection())
selectionManager.register('vertex', new VertexSelection())

export default selectionManager
