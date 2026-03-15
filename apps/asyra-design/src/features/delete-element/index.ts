import { defineFeature, getFeature } from '@asyra/core'
import { endTransaction, startTransaction } from '@asyra/reactive-events'
import {
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'


export const deleteElementFeature = defineFeature(
  FeatureNames.DELETE_SELECTED_ELEMENT,
  InputSystemEvents.INPUT_SHORTCUT_DELETE,
  {
    priority: 100,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      if (systemContextApis.getPathEditingMode()) {
        return null
      }

      const selectedIds = selectionApis.getSelectedIds()
      if (selectedIds.length !== 1) {
        return null
      }

      const elementId = selectedIds[0]
      startTransaction()
      try {
        selectionApis.selectElements([])

        const deleted = elementApis.deleteElement(elementId)
        if (!deleted) {
          return null
        }

        return { deletedElementId: elementId }
      } finally {
        endTransaction()
      }
    }
  }
)

export default deleteElementFeature
