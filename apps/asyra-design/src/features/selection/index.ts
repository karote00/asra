import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import {
  selectElements,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'
import type { ModifierKeys } from '@asyra/utils'

export const selectionFeature = defineFeature('selection', 'input.drag', {
  priority: 5,
  exclusive: false,
  api: {
    getSelectedIds: () => core.deps.selection.getElementSelectionIds(),
    clearSelection: () => {
      startTransaction()
      selectElements([])
      endTransaction()
    },
    toggleSelection: (elementId: string) => {
      const currentIds = core.deps.selection.getElementSelectionIds()
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

      const systemContext = core.deps.systemContext.getSystemContextSnapshot()
      const hoveredElementId = systemContext.target?.hoveredElementId

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
