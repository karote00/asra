import SelectionManager from './selection-manager'
import BaseSelection from './selections/base-selection'

const selectionManager = new SelectionManager()

export { SelectionManager, BaseSelection }
export type { SelectionDefinition } from './selections/base-selection'
export default selectionManager
