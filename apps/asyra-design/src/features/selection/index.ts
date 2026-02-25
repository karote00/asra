import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/core'
import {
  elementApis,
  selectionApis,
  systemContextApis,
  transactionApis
} from '../../common-apis'
import {
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'

interface SelectionAPI {
  getSelectedIds: () => string[]
  clearSelection: () => void
  toggleSelection: (elementId: string) => void
  [key: string]: unknown
}

const api: SelectionAPI = {
  getSelectedIds: () => selectionApis.getSelectedIds(),
  clearSelection: () => {
    selectionApis.clearSelection()
  },
  toggleSelection: (elementId: string) => {
    selectionApis.toggleSelection(elementId)
  }
}

const clearPathEditingIfSelectionChanged = () => {
  const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
  if (!pathEditingVectorId) {
    return
  }

  const selectedIds = selectionApis.getSelectedIds()
  if (selectedIds.length === 1 && selectedIds[0] === pathEditingVectorId) {
    return
  }

  systemContextApis.exitPathEditingMode()
}

export const selectionFeature = defineFeature(
  FeatureNames.SELECTION,
  InputSystemEvents.INPUT_DRAG,
  {
    priority: 5,
    exclusive: false,
    api,
    session: {
      onStart: (snapshot: SystemContextSnapshot) => {
        const { primaryTool } = snapshot
        const mouse = snapshot.mouse
        const pathEditingVectorId = systemContextApis.getPathEditingVectorId()

        if (primaryTool !== PrimaryToolType.SELECT || !mouse.down) {
          return null
        }

        // In path editing mode, keep focus on the current vector only.
        if (pathEditingVectorId) {
          return null
        }

        const hoveredElementId =
          elementApis.getElementIdAtClientPos(mouse.position) ??
          snapshot.target?.hoveredElementId

        transactionApis.startTransaction()
        try {
          if (hoveredElementId) {
            if (snapshot.key.shift) {
              api.toggleSelection(hoveredElementId)
            } else {
              selectionApis.selectElements([hoveredElementId])
            }
          } else {
            // Click on empty space on canvas - deselect
            selectionApis.selectElements([])
          }

          clearPathEditingIfSelectionChanged()
        } finally {
          transactionApis.endTransaction()
        }

        return { action: 'selection-updated' }
      },
      onUpdate: () => {
        return
      },
      onEnd: () => {
        return
      }
    }
  }
)

export default selectionFeature
