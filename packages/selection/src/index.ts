import SelectionManager from './selection-manager.js'
import BaseSelection from './selections/base-selection.js'

const selectionManager = new SelectionManager()

export { SelectionManager, BaseSelection }
export type { SelectionDefinition } from './selections/base-selection.js'
export default selectionManager
