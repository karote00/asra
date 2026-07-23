import { defineFeature, runTransaction } from '@asyra/core'
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
      return runTransaction(() => {
        selectionApis.selectElements([])

        const deleted = elementApis.deleteElement(elementId)
        if (!deleted) {
          return null
        }

        const hoveredAfterDelete = elementApis.getElementIdAtClientPos(
          snapshot.mousePosition
        )
        systemContextApis.updateHoveredElementId(
          hoveredAfterDelete === elementId ? null : hoveredAfterDelete
        )

        return { deletedElementId: elementId }
      })
    }
  }
)

export default deleteElementFeature
