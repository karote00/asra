import {
  subscribeUndoRedoStatus,
  subscribeToAddElement,
  subscribeToRemoveElement,
  startTransaction,
  updateTransaction,
  endTransaction,
  subscribeToRequestSceneTreeData,
  finishRequestSceneTreeData
} from '@asra/reactive-events'
import type { ElementInstanceTypes } from '@asra/utils'
import { UNDO } from '@asra/utils'
import sceneTree from './sceneTree'

export const initSceneTreeSubscribes = () => {
  let inUndoRedo = false
  subscribeUndoRedoStatus(({ status }) => {
    inUndoRedo = status !== UNDO.NONE
  })

  subscribeToRequestSceneTreeData(() => {
    finishRequestSceneTreeData(sceneTree.save())
  })

  subscribeToAddElement(({ payload }) => {
    const { data, parent, index } = payload

    startTransaction()
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

    endTransaction()
  })

  subscribeToRemoveElement(({ payload }) => {
    const { data, parent, index } = payload
    sceneTree.removeElement(data, index, parent)

    startTransaction()

    sceneTree.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })
    sceneTree.cleanChanges()

    endTransaction()
  })
}
