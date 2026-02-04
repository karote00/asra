import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'

export const selectionFeature = defineFeature('selection', undefined, {
  name: 'selection',
  api: {
    selectElements: (ids: string[]) => {
      core.deps.selection.setElementSelection(ids)
    },
    toggleSelection: (id: string) => {
      const current = core.deps.selection.getElementSelectionIds()
      if (current.includes(id)) {
        const idx = current.indexOf(id)
        const newSelected = [
          ...current.slice(0, idx),
          ...current.slice(idx + 1)
        ]
        core.deps.selection.setElementSelection(newSelected)
      } else {
        core.deps.selection.setElementSelection([...current, id])
      }
    },
    clearSelection: () => {
      core.deps.selection.setElementSelection([])
    },
    getSelectedIds: () => core.deps.selection.getElementSelectionIds()
  },
  define: ({ on }: any) => {
    on('select_single', ({ elementId }: any) => {
      const api = selectionFeature.api as any
      api.selectElements([elementId])
    })

    on('toggle_selection', ({ elementId }: any) => {
      const api = selectionFeature.api as any
      api.toggleSelection(elementId)
    })

    on('clear_selection', () => {
      const api = selectionFeature.api as any
      api.clearSelection()
    })
  }
})

export default selectionFeature
