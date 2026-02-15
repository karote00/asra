import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/feature-system'
import { selectionApis, transactionApis } from '../../common-apis'
import { PrimaryToolType } from '../../constants'

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

export const selectionFeature = defineFeature('selection', 'input.drag', {
  priority: 5,
  exclusive: false,
  api,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
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
