import { WorkflowRegistryClass } from '@asyra/core'
import { undoRedoWorkflow } from './undo'
import { zoomFitWorkflow, wheelScrollWorkflow } from './viewport'
import {
  dragStartWorkflow,
  dragUpdateWorkflow,
  dragEndWorkflow
} from './render'
import { switchPrimaryToolWorkflow } from './primary-tool'
import { InputSystemEvents } from '../../constants'

export const registerWorkflows = (workflowRegistry: WorkflowRegistryClass) => {
  workflowRegistry.register(InputSystemEvents.INPUT_SHORTCUT_UNDOREDO, undoRedoWorkflow)
  workflowRegistry.register(InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET, zoomFitWorkflow)
  workflowRegistry.register(InputSystemEvents.INPUT_WHEEL_SCROLL, wheelScrollWorkflow)
  workflowRegistry.register(InputSystemEvents.INPUT_DRAG_START, dragStartWorkflow)
  workflowRegistry.register(InputSystemEvents.INPUT_DRAG_UPDATE, dragUpdateWorkflow)
  workflowRegistry.register(InputSystemEvents.INPUT_DRAG_END, dragEndWorkflow)
  workflowRegistry.register(
    InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
    switchPrimaryToolWorkflow
  )
}
