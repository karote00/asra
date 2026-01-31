import { WorkflowRegistryClass } from '@asyra/core'
import { undoRedoWorkflow } from './undo'
import { zoomFitWorkflow, wheelScrollWorkflow } from './viewport'
import {
  dragStartWorkflow,
  dragUpdateWorkflow,
  dragEndWorkflow
} from './render'
import { switchPrimaryToolWorkflow } from './primary-tool'

export const registerWorkflows = (workflowRegistry: WorkflowRegistryClass) => {
  workflowRegistry.register('input.shortcut.undoredo', undoRedoWorkflow)
  workflowRegistry.register('input.shortcut.zoomPreset', zoomFitWorkflow)
  workflowRegistry.register('input.wheel.scroll', wheelScrollWorkflow)
  workflowRegistry.register('input.drag.start', dragStartWorkflow)
  workflowRegistry.register('input.drag.update', dragUpdateWorkflow)
  workflowRegistry.register('input.drag.end', dragEndWorkflow)
  workflowRegistry.register(
    'input.shortcut.switchPrimaryTool',
    switchPrimaryToolWorkflow
  )
}
