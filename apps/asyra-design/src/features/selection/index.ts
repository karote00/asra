import { defineFeature } from '@asyra/feature-system'
import { selectElements } from '@asyra/reactive-events'
import { systemContext, selection } from '../../contexts'
import { selectionApis, transactionApis } from '../../common-apis'
import type { ModifierKeys } from '@asyra/utils'

export const selectionFeature = defineFeature('selection', 'input.drag', {
  priority: 5,
  exclusive: false,
  api: {
    getSelectedIds: () => selectionApis.getSelectedIds(),
    clearSelection: () => {
      selectionApis.clearSelection()
    },
    toggleSelection: (elementId: string) => {
      selectionApis.toggleSelection(elementId)
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

      transactionApis.startTransaction()
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
        transactionApis.endTransaction()
      }

      return { action: 'selection-updated' }
    }
  }
})

export default selectionFeature
