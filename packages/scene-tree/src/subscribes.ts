import {
  EventTypes,
  getTransactionReplayMode,
  subscribeToEventBatches,
  subscribeToSynchronousEvent,
  subscribeToSynchronousEventBatch,
  subscribeToSceneTreeInit,
  subscribeToSceneTreeLoadData,
  sceneTreeLoadComplete,
  type AddElementEvent,
  type AddElementsEvent,
  type ChangeSubtreeEvent,
  type RemoveElementEvent,
  type RemoveElementsEvent,
  type MoveElementsEvent,
  type UpdateElementDataEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  type ElementRawData,
  type GroupInstanceTypes
} from '@asyra/utils'
import sceneTree from './sceneTree.js'
import { isGroupEntity } from './entity-data.js'

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

  const applyElementReplayBatch = (
    events: readonly (AddElementEvent | RemoveElementEvent)[]
  ): boolean => {
    const firstEvent = events[0]
    if (!firstEvent || getTransactionReplayMode() === null) {
      return false
    }
    const entries = events.map(({ payload }) => {
      const { data } = payload
      const { parentId, index } = payload as typeof payload & {
        parentId?: string
        index?: number
      }
      if (
        typeof data.id !== 'string' ||
        typeof parentId !== 'string' ||
        !Number.isInteger(index) ||
        Number(index) < 0
      ) {
        throw new Error(
          `Cannot replay element ${data.id ?? ''}: exact parent-index evidence is required`
        )
      }
      return {
        data: data as ElementRawData,
        parentId,
        index: Number(index)
      }
    })
    const preparedMutation =
      firstEvent.type === EventTypes.ADD_ELEMENT
        ? sceneTree.prepareCanonicalElementInsertion({ entries })
        : sceneTree.prepareCanonicalElementRemoval(entries)
    return (
      sceneTree.applyPreparedElementMutation(
        preparedMutation,
        firstEvent.options
      ).orderedElementIds.length === entries.length
    )
  }

  subscribeToSynchronousEventBatch<AddElementEvent>(
    EventTypes.ADD_ELEMENT,
    applyElementReplayBatch
  )
  subscribeToSynchronousEventBatch<RemoveElementEvent>(
    EventTypes.REMOVE_ELEMENT,
    applyElementReplayBatch
  )

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
      if (getTransactionReplayMode() !== null) {
        if (
          typeof parentId !== 'string' ||
          !Number.isInteger(index) ||
          Number(index) < 0
        ) {
          throw new Error(
            `Cannot restore element ${data.id ?? ''}: exact parent-index evidence is required`
          )
        }
        const preparedMutation = sceneTree.prepareCanonicalElementInsertion({
          entries: [
            {
              data: data as ElementRawData,
              parentId,
              index: Number(index)
            }
          ]
        })
        return (
          sceneTree.applyPreparedElementMutation(preparedMutation, options)
            .orderedElementIds.length === 1
        )
      }
      return (
        sceneTree.addNewElement(data, resolvedParent, index, options) !== ''
      )
    }
  )

  subscribeToSynchronousEvent<RemoveElementEvent>(
    EventTypes.REMOVE_ELEMENT,
    ({ payload, options }) => {
      const { data, parent, parentId, index } = payload as typeof payload & {
        parentId?: string
        index?: number
      }
      if (
        getTransactionReplayMode() !== null &&
        typeof data.id === 'string' &&
        typeof parentId === 'string' &&
        Number.isInteger(index) &&
        Number(index) >= 0
      ) {
        const preparedMutation = sceneTree.prepareCanonicalElementRemoval([
          {
            data: data as ElementRawData,
            parentId,
            index: Number(index)
          }
        ])
        return (
          sceneTree.applyPreparedElementMutation(preparedMutation, options)
            .orderedElementIds.length === 1
        )
      }
      return sceneTree.removeElement(data, parent, options)
    }
  )

  subscribeToSynchronousEvent<AddElementsEvent>(
    EventTypes.ADD_ELEMENTS,
    ({ payload, options }) => {
      if (payload.action !== SCENE_TREE_ACTIONS.ADD_ELEMENTS) {
        return false
      }
      const preparedMutation = sceneTree.prepareCanonicalElementInsertion({
        entries: payload.entries
      })
      return (
        sceneTree.applyPreparedElementMutation(preparedMutation, options)
          .orderedElementIds.length === payload.entries.length
      )
    }
  )

  subscribeToSynchronousEvent<RemoveElementsEvent>(
    EventTypes.REMOVE_ELEMENTS,
    ({ payload, options }) => {
      if (payload.action !== SCENE_TREE_ACTIONS.REMOVE_ELEMENTS) {
        return false
      }
      const preparedMutation = sceneTree.prepareCanonicalElementRemoval(
        payload.entries.map(({ data, parentId, index }) => ({
          data,
          parentId,
          index
        }))
      )
      return (
        sceneTree.applyPreparedElementMutation(preparedMutation, options)
          .orderedElementIds.length === payload.entries.length
      )
    }
  )

  subscribeToSynchronousEvent<MoveElementsEvent>(
    EventTypes.MOVE_ELEMENTS,
    ({ payload, options }) => {
      if ('moves' in payload) {
        return sceneTree.applyHierarchyMoves(payload.moves, options)
      }
      return sceneTree.moveElements(payload.request, options).moves.length > 0
    }
  )

  subscribeToSynchronousEvent<ChangeSubtreeEvent>(
    EventTypes.CHANGE_SUBTREE,
    ({ payload, options }) => sceneTree.applySubtreeChange(payload, options)
  )

  subscribeToSynchronousEvent<UpdateElementDataEvent>(
    EventTypes.UPDATE_ELEMENT_DATA,
    ({ payload }) => {
      const { id, changes } = payload
      const element = sceneTree.getElementById(id)
      if (!element || changes.length === 0) {
        return false
      }

      const valid = changes.every(({ key, before, after }) => {
        if (key === 'name') {
          return (
            typeof before === 'string' &&
            typeof after === 'string' &&
            element.get(key) === before
          )
        }
        return (
          (key === 'visible' || key === 'lock') &&
          typeof before === 'boolean' &&
          typeof after === 'boolean' &&
          element.get(key) === before
        )
      })
      if (!valid) {
        return false
      }

      const values: {
        name?: string
        visible?: boolean
        lock?: boolean
      } = {}
      changes.forEach(({ key, after }) => {
        if (key === 'name') {
          values.name = after as string
        } else if (key === 'visible') {
          values.visible = after as boolean
        } else {
          values.lock = after as boolean
        }
      })
      const preparedMutation = sceneTree.prepareElementDataMutation([
        {
          elementId: id,
          values
        }
      ])
      sceneTree.applyPreparedElementMutation(preparedMutation)
      return true
    }
  )

  subscribeToEventBatches((events) => {
    const sourcePropertyIds: string[] = []
    const seenPropertyIds = new Set<string>()
    const appendPropertyId = (propertyId: string): void => {
      if (!seenPropertyIds.has(propertyId)) {
        seenPropertyIds.add(propertyId)
        sourcePropertyIds.push(propertyId)
      }
    }

    events.forEach((event) => {
      if (
        event.type === EventTypes.UPDATE_TRANSACTION &&
        'eventName' in event &&
        event.eventName === EventTypes.UPDATE_PROPERTY &&
        isUpdatePropertyChange(event.payload)
      ) {
        const propertyPayload = event.payload
        const transactionEvent = event as UpdateTransactionEvent
        const orderedPropertyIds = transactionEvent.canonicalEvidence
          ?.orderedIds ?? [propertyPayload.id]
        orderedPropertyIds.forEach(appendPropertyId)
        return
      }
      if (
        event.type === EventTypes.UPDATE_PROPERTY &&
        'payload' in event &&
        isUpdatePropertyChange(event.payload)
      ) {
        appendPropertyId(event.payload.id)
      }
    })

    if (sourcePropertyIds.length > 0) {
      sceneTree.projectLocalComputedDataFromPropertyIds(sourcePropertyIds)
    }
  })
}
