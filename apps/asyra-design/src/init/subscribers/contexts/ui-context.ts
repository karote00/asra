/**
 * Subscribers - Simple forwarding layer
 */

import { UIContext } from '@asyra/ui-context'
import { SELECTION_ACTIONS, SELECTION_TYPES, SelectionYjsChange } from '@asyra/utils'
import { subscribeToDecideToSelectElements, subscribeToDecideToSwitchPrimaryTool } from '../../events'
import { uiContextApis } from '../../apis'
import { factory, systemContext } from '../../../contexts'

export const initUIContextSubscribers = () => {
  subscribeToDecideToSwitchPrimaryTool(() => {
    const newPrimaryTool = systemContext.getCurrentPrimaryTool()
    uiContextApis.switchPrimaryTool(newPrimaryTool)
  })

  subscribeToDecideToSelectElements(() => {

  })
}

const selectionStore = UIContext.createSelectionStore()

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
const collectElementSelectionChange = (event) => {
  console.log('collectElementSelectionChange')
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

export const initSelectionYJSDataSubscribe = () => {
  console.log('initSelectionYJSDataSubscribe')
  if (hasInit) {
    return
  }

  const elementSelectionArray = factory.elementSelectionMap
  elementSelectionArray.observe(collectElementSelectionChange)

  // subscribeToRequestElementSelection(() => {
  //   finishRequestElementSelection(uiContext.elementSelection.getValue())
  // })

  hasInit = true
}
