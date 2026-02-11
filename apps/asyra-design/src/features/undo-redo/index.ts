import { defineFeature } from '@asyra/feature-system'
import { historyApis } from '../../common-apis'
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
        historyApis.redo()
        return { redid: true }
      } else {
        historyApis.undo()
        return { undid: true }
      }
    }
  }
)

export default undoRedoFeature
