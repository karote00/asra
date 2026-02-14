import type { SelectionYjsChange } from '@asyra/utils'
import { SELECTION_ACTIONS, SELECTION_TYPES } from '@asyra/utils'
import factory from '@asyra/factory'
import {
  finishRequestElementSelection,
  subscribeToRequestElementSelection
} from '@asyra/reactive-events'
import SelectionStore from '../stores/selection'
import uiContext from '../ui-context'

export const selectionStore = new SelectionStore()

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

  subscribeToRequestElementSelection(() => {
    const selection =
      uiContext.get<Set<string>>('elementSelection') || new Set()
    finishRequestElementSelection(selection)
  })

  hasInit = true
}
