/**
 * Selection Feature
 * Manages element selection with transaction support
 */
import core from '../../contexts'
// @ts-ignore - feature-system not fully integrated yet
import { defineFeature, importFeature } from '@asyra/feature-system'

const packages = core.deps

export const selectionFeature: any = defineFeature(
  'selection',
  ({ packages, importFeature }: any) => ({
    api: {
      selectElements: (ids: string[]) => {
        const txn = importFeature('transaction')
        txn.start()
        packages.selection.selectElements(ids)
        txn.end()
      },
      toggleSelection: (id: string) => {
        const txn = importFeature('transaction')
        txn.start()
        const current = packages.selection.getElementSelectionIds()
        if (current.includes(id)) {
          packages.selection.deselectElements([id])
        } else {
          packages.selection.selectElements([id])
        }
        txn.end()
      },
      clearSelection: () => {
        const txn = importFeature('transaction')
        txn.start()
        packages.selection.clearSelection()
        txn.end()
      },
      getSelectedIds: () => packages.selection.getElementSelectionIds()
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
)

export default selectionFeature
