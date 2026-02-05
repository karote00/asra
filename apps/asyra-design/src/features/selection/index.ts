import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import { selectElements } from '@asyra/reactive-events'
import { InputSystemEvents, PrimaryToolType } from '../../constants'
import type { ModifierKeys } from '@asyra/utils'
import { featureKeyConfigs } from '../../config/key-combinations'

export const selectionFeature = defineFeature(
  'selection',
  {
    SELECT_ELEMENTS_DRAG_START: featureKeyConfigs.SELECT_ELEMENTS_DRAG_START
  },
  {
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
    define: ({ execution }: any) => {
      // Register execution handler for selection (one-time action)
      execution.register(
        InputSystemEvents.INPUT_DRAG_START,
        { priority: 5, exclusive: false },
        (snapshot: {
          primaryTool: string
          mouse: { down: boolean }
          key: ModifierKeys
        }) => {
          const { primaryTool, mouse } = snapshot

          if (primaryTool !== PrimaryToolType.SELECT || !mouse.down) {
            return null
          }

          const systemContext =
            core.deps.systemContext.getSystemContextSnapshot()
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
      )
    }
  }
)

export default selectionFeature
