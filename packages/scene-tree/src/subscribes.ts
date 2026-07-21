import {
  EventTypes,
  getTransactionReplayMode,
  subscribeToSynchronousEvent,
  subscribeToChangeComputedData,
  subscribeToChangeComputedDataBatch,
  subscribeToChangeComputedDataPatch,
  subscribeToSceneTreeInit,
  subscribeToSceneTreeLoadData,
  subscribeToUpdateTransaction,
  sceneTreeLoadComplete,
  type AddElementEvent,
  type RemoveElementEvent,
  type UpdateComputedDataBatchEvent,
  type UpdateComputedDataEvent,
  type UpdateComputedDataPatchEvent
} from '@asyra/reactive-events'
import propsManager from '@asyra/props-manager'
import {
  PROPS_ACTIONS,
  type DataTypes,
  type ComputedDataPatch,
  type ComputedDataPatchChange,
  type ComputedAttrs,
  type GroupInstanceTypes
} from '@asyra/utils'
import sceneTree from './sceneTree'
import { isGroupEntity } from './utils'

const setOwnEnumerableValue = (
  target: object,
  key: PropertyKey,
  value: unknown
): void => {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true
  })
}

const toAppliedComputedDataPatch = (
  patch: ComputedDataPatchChange
): ComputedDataPatch => {
  const applied: ComputedDataPatch = {}

  Object.entries(patch.values ?? {}).forEach(([key, change]) => {
    applied.values ??= {}
    setOwnEnumerableValue(applied.values, key, change.after)
  })

  Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
    const nextRecordPatch: NonNullable<ComputedDataPatch['records']>[string] =
      {}

    Object.entries(recordPatch.set ?? {}).forEach(([recordId, change]) => {
      nextRecordPatch.set ??= {}
      setOwnEnumerableValue(nextRecordPatch.set, recordId, change.after)
    })

    const removeIds = Object.keys(recordPatch.remove ?? {})
    if (removeIds.length > 0) {
      nextRecordPatch.remove = removeIds
    }

    if (
      Object.keys(nextRecordPatch.set ?? {}).length > 0 ||
      (nextRecordPatch.remove?.length ?? 0) > 0
    ) {
      applied.records ??= {}
      setOwnEnumerableValue(applied.records, key, nextRecordPatch)
    }
  })

  return applied
}

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
  subscribeToSceneTreeInit(() => {
    sceneTree.init()
    sceneTreeLoadComplete()
  })

  subscribeToSceneTreeLoadData(({ payload }) => {
    sceneTree.load(payload.data)
    sceneTreeLoadComplete()
  })

  subscribeToSynchronousEvent<AddElementEvent>(
    EventTypes.ADD_ELEMENT,
    ({ payload, options }) => {
      const { data, parent, parentId, index } = payload
      const recordedParent = parentId
        ? sceneTree.getElementById(parentId)
        : undefined
      if (
        parentId &&
        (!recordedParent || !isGroupEntity(recordedParent.get('type')))
      ) {
        throw new Error(
          `Cannot restore element ${data.id ?? ''}: parent ${parentId} is unavailable`
        )
      }
      const resolvedParent =
        parent ?? (recordedParent as GroupInstanceTypes | undefined)
      return (
        sceneTree.addNewElement(
          data,
          resolvedParent,
          index,
          getTransactionReplayMode() !== null,
          options
        ) !== ''
      )
    }
  )

  subscribeToSynchronousEvent<RemoveElementEvent>(
    EventTypes.REMOVE_ELEMENT,
    ({ payload, options }) => {
      const { data, parent } = payload
      return sceneTree.removeElement(data, parent, options)
    }
  )

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

  subscribeToChangeComputedDataPatch(async ({ payload, options }) => {
    const { elementIds, patch } = payload

    sceneTree.patchComputedDataForElements(elementIds, patch, options)
    propsManager.cleanChanges()
    sceneTree.commitSceneTreeTransaction(options)
  })

  subscribeToSynchronousEvent<
    UpdateComputedDataEvent | UpdateComputedDataBatchEvent
  >(EventTypes.UPDATE_COMPUTED_DATA, ({ payload }) => {
    const { id } = payload
    const options = undefined
    const previousSceneChangeCount = sceneTree.changes.length
    const previousPropsChangeCount = propsManager.changes.length
    const element = sceneTree.getElementById(id)
    if (!element) {
      return false
    }
    const changes = 'changes' in payload ? payload.changes : [payload]
    if (
      changes.length === 0 ||
      changes.some(
        ({ key, owner }) =>
          typeof key !== 'string' || (owner !== 'raw' && owner !== 'computed')
      )
    ) {
      return false
    }
    const elementOwner = element as unknown as {
      set: (key: string, value: DataTypes) => void
    }

    changes.forEach(({ key, after, owner }) => {
      if (owner === 'raw') {
        elementOwner.set(key, after)
        return
      }
      sceneTree.updateComputedData(
        id,
        key as keyof ComputedAttrs,
        after as ComputedAttrs[keyof ComputedAttrs],
        options
      )
    })
    const applied =
      sceneTree.changes.length > previousSceneChangeCount ||
      propsManager.changes.length > previousPropsChangeCount
    propsManager.commitChanges(options)
    sceneTree.commitSceneTreeTransaction(options)
    return applied
  })

  subscribeToSynchronousEvent<UpdateComputedDataPatchEvent>(
    EventTypes.UPDATE_COMPUTED_DATA_PATCH,
    ({ payload }) => {
      const { id, patch } = payload
      const options = undefined
      const previousSceneChangeCount = sceneTree.changes.length
      const previousPropsChangeCount = propsManager.changes.length

      sceneTree.patchComputedData(
        id,
        toAppliedComputedDataPatch(patch),
        options
      )
      const applied =
        sceneTree.changes.length > previousSceneChangeCount ||
        propsManager.changes.length > previousPropsChangeCount
      propsManager.cleanChanges()
      sceneTree.commitSceneTreeTransaction(options)
      return applied
    }
  )

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
      sceneTree.refreshComputedDataFromProperty(
        ownerElementId,
        ownerPropertyName,
        sceneTreeOptions
      )
    }

    sceneTree.commitSceneTreeTransaction(sceneTreeOptions)
  })
}
