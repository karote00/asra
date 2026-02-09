import { defineFeature } from '@asyra/feature-system'
import { undo, redo } from '@asyra/reactive-events'
import { InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

export const undoRedoFeature = defineFeature(
  'undoRedo',
  InputSystemEvents.INPUT_SHORTCUT_UNDOREDO,
  {
    priority: 100,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      if (snapshot.key.shift) {
        redo()
        return { redid: true }
      } else {
        undo()
        return { undid: true }
      }
    }
  }
)

export default undoRedoFeature
