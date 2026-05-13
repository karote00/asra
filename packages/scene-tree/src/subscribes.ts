import {
  subscribeToRemoveElement,
  subscribeToChangeComputedData,
  subscribeToChangeComputedDataBatch,
  subscribeToUpdateComputedData,
  subscribeToSceneTreeInit,
  subscribeToSceneTreeLoadData,
  subscribeToAddElement,
  subscribeToUpdateTransaction,
  subscribeToUpdateUndoRedoStatus,
  sceneTreeLoadComplete
} from '@asyra/reactive-events'
import propsManager from '@asyra/props-manager'
import {
  PROPS_ACTIONS,
  UNDO,
  type ComputedAttrs,
  DataTypes
} from '@asyra/utils'
import sceneTree from './sceneTree'

const isUpdatePropertyChange = (
  payload: unknown
): payload is {
  action: string
  id: string
  key: string
  before: unknown
  after: unknown
} =>
  typeof payload === 'object' &&
  payload !== null &&
  'action' in payload &&
  payload.action === PROPS_ACTIONS.UPDATE_PROPERTY &&
  'id' in payload &&
  typeof payload.id === 'string' &&
  'key' in payload &&
  typeof payload.key === 'string' &&
  'before' in payload &&
  'after' in payload

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

  subscribeToChangeComputedDataBatch(async ({ payload, options }) => {
    const { elementIds, data } = payload
    const entries = Object.entries(data)

    elementIds.forEach((elementId) => {
      type KEY = keyof ComputedAttrs
      entries.forEach(([key, value]) => {
        sceneTree.updateComputedData(
          elementId,
          key as KEY,
          value as ComputedAttrs[KEY],
          options
        )
      })
    })
    propsManager.commitChanges(options)
    sceneTree.commitSceneTreeTransaction(options)
  })

  subscribeToUpdateComputedData(({ payload }) => {
    const { id, key, after } = payload
    const options = undefined

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
    if (!isUpdatePropertyChange(payload)) {
      return
    }

    const sceneTreeOptions =
      options?.shared === undefined
        ? options
        : {
            ...options,
            shared: undefined
          }

    const ownerElementId =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (payload as any).ownerElementId === 'string'
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload as any).ownerElementId
        : ''
    const ownerPropertyName =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (payload as any).ownerPropertyName === 'string'
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload as any).ownerPropertyName
        : ''

    if (ownerElementId && ownerPropertyName) {
      const ownerElement = sceneTree.getElementById(ownerElementId)
      const ownerPropId = ownerElement?.props.getPropId(ownerPropertyName)
      const ownerPropComponent = ownerPropId
        ? propsManager.getPropertyById(ownerPropId)
        : undefined

      if (ownerPropComponent && ownerPropId) {
        ownerPropComponent.emitChange({
          id: ownerPropId,
          key: payload.key,
          before: payload.before as DataTypes,
          after: payload.after as DataTypes,
          options: sceneTreeOptions
        })
      }
    }

    sceneTree.commitSceneTreeTransaction(sceneTreeOptions)
  })
}
