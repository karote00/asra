import { defineFeature, importFeature } from '@asyra/core'
import { endTransaction, startTransaction } from '@asyra/reactive-events'
import { elementApis, selectionApis, systemContextApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

interface HoverElementFeatureApi {
  reEvaluate?: (snapshot?: SystemContextSnapshot) => string | null
}

const reEvaluateHoverAfterDelete = (snapshot: SystemContextSnapshot) => {
  try {
    const hoverApi = importFeature(
      FeatureNames.HOVER_ELEMENT
    ) as HoverElementFeatureApi

    hoverApi.reEvaluate?.(snapshot)
  } catch {
    // Hover feature may not be available yet; keep current state as-is.
  }
}

export const deleteElementFeature = defineFeature(
  FeatureNames.DELETE_SELECTED_ELEMENT,
  InputSystemEvents.INPUT_SHORTCUT_DELETE,
  {
    priority: 100,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      if (systemContextApis.getPathEditingVectorId()) {
        return null
      }

      const selectedIds = selectionApis.getSelectedIds()
      if (selectedIds.length !== 1) {
        return null
      }

      const elementId = selectedIds[0]
      startTransaction()
      try {
        const deleted = elementApis.deleteElement(elementId)
        if (!deleted) {
          return null
        }

        reEvaluateHoverAfterDelete(snapshot)
        selectionApis.selectElements([])

        return { deletedElementId: elementId }
      } finally {
        endTransaction()
      }
    }
  }
)

export default deleteElementFeature
