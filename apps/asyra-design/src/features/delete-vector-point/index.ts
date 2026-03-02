import { VECTOR_TOKENS, defineFeature } from '@asyra/core'
import { endTransaction, startTransaction } from '@asyra/reactive-events'
import {
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

export const deleteVectorPointFeature = defineFeature(
  FeatureNames.DELETE_VECTOR_POINT,
  InputSystemEvents.INPUT_SHORTCUT_DELETE,
  {
    priority: 110,
    exclusive: true,
    execution: (_snapshot: SystemContextSnapshot) => {
      if (!systemContextApis.getPathEditingMode()) {
        return null
      }

      const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
      if (!pathEditingVectorId) {
        return null
      }

      startTransaction()
      try {
        const selectedPoint = selectionApis
          .getSelectedVectorPoints()
          .find((selection) => selection.elementId === pathEditingVectorId)
        if (
          !selectedPoint ||
          selectedPoint.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR
        ) {
          return null
        }

        const deleted = elementApis.removeVectorAnchorPoint(
          pathEditingVectorId,
          selectedPoint.pointId
        )
        if (!deleted) {
          return null
        }

        selectionApis.selectElements([pathEditingVectorId])
        selectionApis.clearVectorPointSelection()
        selectionApis.clearVectorSegmentSelection()
        systemContextApis.clearVectorPointState()

        return {
          deletedPointId: selectedPoint.pointId,
          elementId: pathEditingVectorId
        }
      } finally {
        endTransaction()
      }
    }
  }
)

export default deleteVectorPointFeature
