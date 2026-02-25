import {
  subscribeToRemoveElement,
  subscribeToChangeComputedData,
  subscribeToUpdateComputedData,
  subscribeToSceneTreeInit,
  subscribeToSceneTreeLoadData,
  subscribeToAddElement,
  subscribeToUpdateUndoRedoStatus,
  sceneTreeLoadComplete
} from '@asyra/reactive-events'
import { UNDO, type ComputedAttrs } from '@asyra/utils'
import sceneTree from './sceneTree'

export const initSceneTreeSubscribes = () => {
  let inUndoRedo = false
  subscribeToUpdateUndoRedoStatus(({ payload }) => {
    inUndoRedo = payload.status !== UNDO.NONE
  })

  subscribeToSceneTreeInit(() => {
    sceneTree.init()
    sceneTreeLoadComplete()
  })

  subscribeToSceneTreeLoadData(({ payload }) => {
    sceneTree.load(payload.data)
    sceneTreeLoadComplete()
  })

  subscribeToAddElement(({ payload, options }) => {
    const { data, parent, index } = payload
    sceneTree.addNewElement(data, parent, index, inUndoRedo, options)
  })

  subscribeToRemoveElement(({ payload, options }) => {
    const { data, parent, index } = payload
    sceneTree.removeElement(data, index, parent, options)
  })

  subscribeToChangeComputedData(async ({ payload, options }) => {
    const { elementIds, key, data } = payload

    elementIds.forEach((elementId) => {
      type KEY = keyof ComputedAttrs
      sceneTree.updateComputedData(
        elementId,
        key as KEY,
        data as ComputedAttrs[KEY],
        options
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
