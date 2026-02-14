import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/feature-system'
import { selectionApis, transactionApis } from '../../common-apis'
import { PrimaryToolType } from '../../constants'

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
    start: (snapshot: SystemContextSnapshot) => {
      const { primaryTool } = snapshot
      const mouse = snapshot.mouse

      if (primaryTool !== PrimaryToolType.SELECT || !mouse.down) {
        return null
      }

      const hoveredElementId = snapshot.target?.hoveredElementId

      transactionApis.startTransaction()
      try {
        if (hoveredElementId) {
          if (snapshot.key.shift) {
            const api = selectionFeature.api as {
              toggleSelection: (elementId: string) => void
            }
            api.toggleSelection(hoveredElementId)
          } else {
            selectionApis.selectElements([hoveredElementId])
          }
        } else {
          // Click on empty space on canvas - deselect
          selectionApis.selectElements([])
        }
      } finally {
        transactionApis.endTransaction()
      }

      return { action: 'selection-updated' }
    }
  }
})

export default selectionFeature
