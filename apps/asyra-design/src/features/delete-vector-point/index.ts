import { VECTOR_TOKENS, defineFeature, runTransaction } from '@asyra/core'
import {
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'
import { createStructuralVectorOperationPatchIntent } from '../path-editing-intents'

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

      return runTransaction(() => {
        const selectedPoint = selectionApis
          .getSelectedVectorPoints()
          .find((selection) => selection.elementId === pathEditingVectorId)
        if (
          !selectedPoint ||
          selectedPoint.target !== VECTOR_TOKENS.POINT.TARGET.ANCHOR
        ) {
          return null
        }

        const structuralOperationIntent =
          createStructuralVectorOperationPatchIntent({
            elementId: pathEditingVectorId,
            operation: 'remove-anchor',
            inputIds: [selectedPoint.pointId],
            changedRecords: ['point:remove', 'segment:remove'],
            undoable: true
          })
        if (!structuralOperationIntent) {
          return null
        }

        const deleted = elementApis.removeVectorAnchorPoint(
          pathEditingVectorId,
          selectedPoint.pointId,
          {
            structuralOperationIntent
          }
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
          elementId: pathEditingVectorId,
          structuralOperationIntent
        }
      })
    }
  }
)

export default deleteVectorPointFeature
