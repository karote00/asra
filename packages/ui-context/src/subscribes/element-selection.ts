import type { SelectionYjsChange } from '@asra/utils'
import { SELECTION_ACTIONS, SELECTION_TYPES } from '@asra/utils'
import selectionManager from '@asra/selection'
import factory from '@asra/factory'
import SelectionStore from '../stores/selection'

export const selectionStore = new SelectionStore(selectionManager)

const updateUIElementSelection = (change: SelectionYjsChange['payload']) => {
  switch (change.action) {
    case SELECTION_ACTIONS.SELECT_ELEMENTS:
    case SELECTION_ACTIONS.DESELECT_ELEMENTS:
      selectionStore.updateSelection(SELECTION_TYPES.ELEMENT)
      break
    case SELECTION_ACTIONS.SELECT_VERTICES:
    case SELECTION_ACTIONS.DESELECT_VERTICES:
      selectionStore.updateSelection(SELECTION_TYPES.VERTEX)
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
      item.content.getContent().forEach(updateUIElementSelection)
    })
  }

  processChanges(event.changes.added)
  processChanges(event.changes.deleted)
}

let hasInit = false

export const initElementSelectionDataContext = () => {
  if (hasInit) {
    return
  }

  const elementSelectionArray = factory.elementSelectionMap
  elementSelectionArray.observe(collectElementSelectionChange)

  hasInit = true
}
