import SelectionManager from './selection-manager'
import ElementSelection from './selections/element-selection'
import VectorPointSelection from './selections/vector-point-selection'
import VectorSegmentSelection from './selections/vector-segment-selection'
import { initSelectionSubscribes } from './subscribes'
import selectionManager from './selection-manager-instance'

initSelectionSubscribes()

export {
  SelectionManager,
  ElementSelection,
  VectorPointSelection,
  VectorSegmentSelection
}
export default selectionManager
