import { WorkflowRegistryClass } from '@asyra/core'
import { undoRedoWorkflow } from './undo'
import { zoomFitWorkflow, wheelScrollWorkflow } from './viewport'
import {
  dragStartWorkflow,
  dragUpdateWorkflow,
  dragEndWorkflow
} from './render'
import { InputSystemEvents } from '../../constants'
import { selectElementsWorkflow } from './selection'

export const registerWorkflows = (workflowRegistry: WorkflowRegistryClass) => {
  // Workflows disabled - investigating feature-system migration
  /*
  workflowRegistry.register(
    InputSystemEvents.INPUT_SHORTCUT_UNDOREDO,
    undoRedoWorkflow
  )
  workflowRegistry.register(
    InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
    zoomFitWorkflow
  )
  workflowRegistry.register(
    InputSystemEvents.INPUT_SHORTCUT_SELECT_ELEMENTS,
    selectElementsWorkflow
  )
  workflowRegistry.register(
    InputSystemEvents.INPUT_WHEEL_SCROLL,
    wheelScrollWorkflow
  )
  workflowRegistry.register(
    InputSystemEvents.INPUT_DRAG_START,
    dragStartWorkflow
  )
  workflowRegistry.register(
    InputSystemEvents.INPUT_DRAG_UPDATE,
    dragUpdateWorkflow
  )
  workflowRegistry.register(InputSystemEvents.INPUT_DRAG_END, dragEndWorkflow)
  */
}
