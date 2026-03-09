import {
  subscribeToRemoveElement,
  subscribeToChangeComputedData,
  subscribeToUpdateComputedData,
  subscribeToSceneTreeInit,
  subscribeToSceneTreeLoadData,
  subscribeToAddElement,
  subscribeToUpdateTransaction,
  subscribeToUpdateUndoRedoStatus,
  sceneTreeLoadComplete
} from '@asyra/reactive-events'
import propsManager from '@asyra/props-manager'
import { PROPS_ACTIONS, UNDO, type ComputedAttrs } from '@asyra/utils'
import sceneTree from './sceneTree'

const isOwnedUpdatePropertyChange = (
  payload: unknown
): payload is {
  action: string
  id: string
  key: string
  ownerElementId: string
  ownerPropertyName: string
} =>
  typeof payload === 'object' &&
  payload !== null &&
  'action' in payload &&
  payload.action === PROPS_ACTIONS.UPDATE_PROPERTY &&
  'id' in payload &&
  typeof payload.id === 'string' &&
  'key' in payload &&
  typeof payload.key === 'string' &&
  'ownerElementId' in payload &&
  typeof payload.ownerElementId === 'string' &&
  'ownerPropertyName' in payload &&
  typeof payload.ownerPropertyName === 'string'

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
    const { data, parent } = payload
    sceneTree.removeElement(data, parent, options)
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
    propsManager.commitChanges(options)
    sceneTree.commitSceneTreeTransaction(options)
  })

  subscribeToUpdateComputedData(({ payload, options }) => {
    const { id, key, after } = payload

    sceneTree.updateComputedData(
      id,
      key as keyof ComputedAttrs,
      after as ComputedAttrs[keyof ComputedAttrs],
      options
    )
    propsManager.commitChanges(options)
    sceneTree.commitSceneTreeTransaction(options)
  })

  subscribeToUpdateTransaction(({ payload, options }) => {
    if (!isOwnedUpdatePropertyChange(payload)) {
      return
    }

    const sceneTreeOptions =
      options?.shared === undefined
        ? options
        : {
            ...options,
            shared: undefined
          }

    sceneTree.refreshComputedDataFromProperty(
      payload.ownerElementId,
      payload.ownerPropertyName,
      sceneTreeOptions
    )
    sceneTree.commitSceneTreeTransaction(sceneTreeOptions)
  })
}
