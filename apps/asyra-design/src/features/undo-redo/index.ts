import { defineFeature } from '@asyra/core'
import { historyApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

export const undoRedoFeature = defineFeature(
  FeatureNames.UNDO_REDO,
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
