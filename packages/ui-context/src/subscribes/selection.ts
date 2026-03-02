import type { SelectionYjsChange } from '@asyra/utils'
import { SELECTION_ACTIONS, SELECTION_TYPES } from '@asyra/utils'
import factory from '@asyra/factory'
import SelectionStore from '../stores/selection'

export const selectionStore = new SelectionStore()

const updateUIElementSelection = (change: SelectionYjsChange['payload']) => {
  switch (change.action) {
    case SELECTION_ACTIONS.SELECT_ELEMENTS:
    case SELECTION_ACTIONS.DESELECT_ELEMENTS:
      selectionStore.updateSelection(SELECTION_TYPES.ELEMENT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_POINTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_POINTS:
      selectionStore.updateSelection(SELECTION_TYPES.VECTOR_POINT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_SEGMENTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_SEGMENTS:
      selectionStore.updateSelection(SELECTION_TYPES.VECTOR_SEGMENT)
      break
  }
}

// @ts-expect-error: It's YJS event
export const collectElementSelectionChange = (event) => {
  const processChanges = (
    items: typeof event.changes.added | typeof event.changes.deleted
  ) => {
    // @ts-expect-error: It's YJS event
    items.forEach((item) => {
      item.content
        .getContent()
        .forEach((change: SelectionYjsChange['payload']) => {
          updateUIElementSelection(change)
        })
    })
  }

  processChanges(event.changes.added)
  processChanges(event.changes.deleted)
}

let hasInit = false

export const initSelectionDataSubscribe = () => {
  if (hasInit) {
    return
  }

  const elementSelectionArray = factory.elementSelectionMap
  elementSelectionArray.observe(collectElementSelectionChange)

  hasInit = true
}
