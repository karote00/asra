import {
  subscribeUndoRedoStatus,
  subscribeToAddElement,
  subscribeToRemoveElement,
  subscribeToChangeComputedData,
  updateTransaction,
  requestElementSelection
} from '@asra/reactive-events'
import type { ComputedAttrs, ElementInstanceTypes } from '@asra/utils'
import { UNDO } from '@asra/utils'
import sceneTree from './sceneTree'

const updateSceneTreeTransaction = () => {
  sceneTree.changes.forEach((change) => {
    updateTransaction(change.eventName, change)
  })
}

const clearSceneTreeChanges = () => {
  sceneTree.cleanChanges()
}

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
    updateSceneTreeTransaction()
    clearSceneTreeChanges()
  })

  subscribeToRemoveElement(({ payload }) => {
    const { data, parent, index } = payload
    sceneTree.removeElement(data, index, parent)

    updateSceneTreeTransaction()
    clearSceneTreeChanges()
  })

  subscribeToChangeComputedData(async ({ payload }) => {
    const { key, data } = payload
    const elementIds = await requestElementSelection()

    elementIds.forEach((elementId) => {
      type KEY = keyof ComputedAttrs
      sceneTree.updateComputedData(
        elementId,
        key as KEY,
        data as ComputedAttrs[KEY]
      )
    })
    updateSceneTreeTransaction()
    clearSceneTreeChanges()
  })
}
