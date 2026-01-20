import {
  subscribeToRemoveElement,
  subscribeToChangeComputedData,
  subscribeToUpdateComputedData,
  subscribeToSceneTreeInit,
  subscribeToSceneTreeLoadData,
  subscribeToAddElement,
  subscribeToUpdateUndoRedoStatus
} from '@asra/reactive-events'
import { ElementRawData, UNDO, type ComputedAttrs } from '@asra/utils'
import sceneTree from './sceneTree'

export const initSceneTreeSubscribes = () => {
  let inUndoRedo = false
  subscribeToUpdateUndoRedoStatus(({ payload }) => {
    inUndoRedo = payload.status !== UNDO.NONE
  })

  subscribeToSceneTreeInit(() => {
    sceneTree.init()
  })

  subscribeToSceneTreeLoadData(({ payload }) => {
    sceneTree.load(payload.data)
  })

  subscribeToAddElement(({ payload }) => {
    const { data, parent, index } = payload
    sceneTree.addNewElement(data as ElementRawData, parent, index, inUndoRedo)

    sceneTree.commitSceneTreeTransaction()
  })

  subscribeToRemoveElement(({ payload }) => {
    const { data, parent, index } = payload
    sceneTree.removeElement(data, index, parent)

    sceneTree.commitSceneTreeTransaction()
  })

  subscribeToChangeComputedData(async ({ payload, options }) => {
    const { elementIds, key, data } = payload

    elementIds.forEach((elementId) => {
      type KEY = keyof ComputedAttrs
      sceneTree.updateComputedData(
        elementId,
        key as KEY,
        data as ComputedAttrs[KEY]
      )
    })
    sceneTree.commitSceneTreeTransaction(options)
  })

  subscribeToUpdateComputedData(({ payload }) => {
    const { id, key, after } = payload

    sceneTree.updateComputedData(
      id,
      key as keyof ComputedAttrs,
      after as ComputedAttrs[keyof ComputedAttrs]
    )
    sceneTree.commitSceneTreeTransaction()
  })
}
