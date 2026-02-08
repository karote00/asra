import { defineFeature } from '@asyra/feature-system'
import {
  selectElements,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'
import { systemContext, selection } from '../../contexts'
import type { ModifierKeys } from '@asyra/utils'

export const selectionFeature = defineFeature('selection', 'input.drag', {
  priority: 5,
  exclusive: false,
  api: {
    getSelectedIds: () => selection.getElementSelectionIds(),
    clearSelection: () => {
      startTransaction()
      selectElements([])
      endTransaction()
    },
    toggleSelection: (elementId: string) => {
      const currentIds = selection.getElementSelectionIds()
      startTransaction()
      if (currentIds.includes(elementId)) {
        selectElements(currentIds.filter((id) => id !== elementId))
      } else {
        selectElements([...currentIds, elementId])
      }
      endTransaction()
    }
  },
  session: {
    start: (snapshot: any) => {
      const { primaryTool } = snapshot
      const mouse = snapshot.mouse

      if (primaryTool !== 'select' || !mouse.down) {
        return null
      }

      const systemContextSnapshot = systemContext.getSystemContextSnapshot()
      const hoveredElementId = systemContextSnapshot.target?.hoveredElementId

      startTransaction()
      try {
        if (hoveredElementId) {
          if (snapshot.key.shift) {
            const api = selectionFeature.api as {
              toggleSelection: (elementId: string) => void
            }
            api.toggleSelection(hoveredElementId)
          } else {
            selectElements([hoveredElementId])
          }
        } else {
          selectElements([])
        }
      } finally {
        endTransaction()
      }

      return { action: 'selection-updated' }
    }
  }
})

export default selectionFeature
