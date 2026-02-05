import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import { selectElements } from '@asyra/reactive-events'
import { InputSystemEvents, PrimaryToolType } from '../../constants'
import type { ModifierKeys } from '@asyra/utils'

export const selectionFeature = defineFeature('selection', undefined, {
  name: 'selection',
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
  define: ({
    handle
  }: {
    handle: (
      event: string,
      callback: (snapshot: {
        primaryTool: string
        mouse: { down: boolean }
        key: ModifierKeys
      }) => any
    ) => void
  }) => {
    handle(InputSystemEvents.INPUT_DRAG_START, (snapshot) => {
      const { primaryTool, mouse } = snapshot

      if (primaryTool === PrimaryToolType.SELECT && mouse.down) {
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
      }

      return null
    })
  }
})

export default selectionFeature
