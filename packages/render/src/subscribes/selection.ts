import factory from '@asyra/factory'
import {
  SELECTION_ACTIONS,
  SELECTION_TYPES,
  SelectionYjsChange
} from '@asyra/utils'
import renderSelection from '../stores/selection'

const updateUIElementSelection = (change: SelectionYjsChange['payload']) => {
  switch (change.action) {
    case SELECTION_ACTIONS.SELECT_ELEMENTS:
    case SELECTION_ACTIONS.DESELECT_ELEMENTS:
      renderSelection.updateSelection(SELECTION_TYPES.ELEMENT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_POINTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_POINTS:
      renderSelection.updateSelection(SELECTION_TYPES.VECTOR_POINT)
      break
    case SELECTION_ACTIONS.SELECT_VECTOR_SEGMENTS:
    case SELECTION_ACTIONS.DESELECT_VECTOR_SEGMENTS:
      renderSelection.updateSelection(SELECTION_TYPES.VECTOR_SEGMENT)
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

export const initSelectionContext = () => {
  const elementSelectionArray = factory.elementSelectionMap
  elementSelectionArray.observe(collectElementSelectionChange)
}
