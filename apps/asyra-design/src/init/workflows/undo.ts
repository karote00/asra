import type { ModifierKeys } from '@asyra/utils'
import type { Workflow } from '@asyra/core/types'

export const undoRedoWorkflow: Workflow = {
  contextUpdate: (core, raw) => {
    core.updateKeyState(raw.modifiers as ModifierKeys)
  },
  coreAPI: 'executeAction',
  APIArgs: () => ['input.shortcut.undoredo']
}
