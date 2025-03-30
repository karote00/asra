import {
  subscribeUndoRedoStatus,
  subscribeToAddElement,
  subscribeToRemoveElement,
  updateTransaction
} from '@asra/reactive-events'
import type { ElementInstanceTypes } from '@asra/utils'
import { UNDO } from '@asra/utils'
import sceneTree from './sceneTree'

export const initSceneTreeSubscribes = () => {
  let inUndoRedo = false
  subscribeUndoRedoStatus(({ status }) => {
    inUndoRedo = status !== UNDO.NONE
  })

  subscribeToAddElement(({ payload }) => {
    const { data, parent, index } = payload

    let newRectangle

    if (inUndoRedo) {
      newRectangle = sceneTree.getRestoreElementById(data.id as string)
    } else {
      newRectangle = sceneTree.createElement(data)
    }

    sceneTree.addNewElement(newRectangle as ElementInstanceTypes, parent, index)
    sceneTree.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })

    sceneTree.cleanChanges()
  })

  subscribeToRemoveElement(({ payload }) => {
    const { data, parent, index } = payload
    sceneTree.removeElement(data, index, parent)

    sceneTree.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })

    sceneTree.cleanChanges()
  })
}
