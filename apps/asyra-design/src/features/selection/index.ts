import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import { selectElements } from '@asyra/reactive-events'
import { InputSystemEvents } from '../../constants'
import type { ModifierKeys } from '@asyra/utils'

export const selectionFeature = defineFeature('selection', 'input.drag.start', {
  priority: 5,
  exclusive: false,
  api: {
    getSelectedIds: () => core.deps.selection.getElementSelectionIds(),
    clearSelection: () => selectElements([]),
    toggleSelection: (elementId: string) => {
      const currentIds = core.deps.selection.getElementSelectionIds()
      if (currentIds.includes(elementId)) {
        selectElements(currentIds.filter((id) => id !== elementId))
      } else {
        selectElements([...currentIds, elementId])
      }
    }
  },
  execution: (snapshot: {
    primaryTool: string
    mouse: { down: boolean }
    key: ModifierKeys
  }) => {
    const { primaryTool, mouse } = snapshot

    if (primaryTool !== 'select' || !mouse.down) {
      return null
    }

    const systemContext = core.deps.systemContext.getSystemContextSnapshot()
    const hoveredElementId = systemContext.target?.hoveredElementId

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

    return { action: 'selection-updated' }
  }
})

export default selectionFeature
