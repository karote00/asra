import type { SharedDelivery, SharedPublication } from '@asyra/factory'
import { EventTypes } from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames
} from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignPublicationProcessor } from '../../collaboration/operations'

const delivery = (
  channel: string,
  eventName: string,
  payload: unknown,
  deliveryId = eventName
): SharedDelivery => ({
  deliveryId,
  transactionId: 1,
  origin: 'action',
  kind: 'forward',
  channel,
  eventName,
  payload,
  sharedDelivery: 'immediate'
})

const publication = (
  deliveries: readonly SharedDelivery[],
  publicationId = 'publication-a'
): SharedPublication => ({
  publicationId,
  transactionId: 1,
  origin: 'action',
  deliveries
})

const validDeliveries = (): readonly SharedDelivery[] => [
  delivery(SharedDataChannelNames.SCENE_TREE, EventTypes.ADD_ELEMENT, {
    action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
    eventName: EventTypes.ADD_ELEMENT,
    data: { id: 'rect-a', type: 'rect' }
  }),
  delivery(SharedDataChannelNames.SCENE_TREE, EventTypes.REMOVE_ELEMENT, {
    action: SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
    eventName: EventTypes.REMOVE_ELEMENT,
    data: { id: 'rect-a', type: 'rect' }
  }),
  delivery(SharedDataChannelNames.SCENE_TREE, EventTypes.UPDATE_COMPUTED_DATA, {
    action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
    eventName: EventTypes.UPDATE_COMPUTED_DATA,
    id: 'rect-a',
    changes: [
      { owner: 'computed', key: 'x', before: 0, after: 10 },
      { owner: 'computed', key: 'y', before: 0, after: 20 }
    ]
  }),
  delivery(
    SharedDataChannelNames.SCENE_TREE,
    EventTypes.UPDATE_COMPUTED_DATA_PATCH,
    {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
      eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      id: 'vector-a',
      patch: { values: { x: { before: 0, after: 10 } } }
    }
  ),
  delivery(SharedDataChannelNames.SCENE_TREE, EventTypes.MOVE_ELEMENTS, {
    action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
    eventName: EventTypes.MOVE_ELEMENTS,
    moves: [
      {
        elementId: 'rect-a',
        before: { parentId: 'workspace-a', index: 0 },
        after: { parentId: 'group-a', index: 0 }
      }
    ]
  }),
  delivery(SharedDataChannelNames.SCENE_TREE, EventTypes.CHANGE_SUBTREE, {
    action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
    undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
    eventName: EventTypes.CHANGE_SUBTREE,
    elementId: 'group-a',
    removed: [
      {
        elementId: 'rect-a',
        parentId: 'group-a',
        index: 0,
        data: { id: 'rect-a', type: 'rect', parentId: 'group-a' }
      },
      {
        elementId: 'group-a',
        parentId: 'workspace-a',
        index: 0,
        data: {
          id: 'group-a',
          type: 'group',
          parentId: 'workspace-a',
          children: ['rect-a']
        }
      }
    ]
  }),
  delivery(SharedDataChannelNames.PROPS, EventTypes.ADD_PROPERTY, {
    action: PROPS_ACTIONS.ADD_PROPERTY,
    eventName: EventTypes.ADD_PROPERTY,
    data: [{ id: 'prop-a', type: 'position' }]
  }),
  delivery(SharedDataChannelNames.PROPS, EventTypes.REMOVE_PROPERTY, {
    action: PROPS_ACTIONS.REMOVE_PROPERTY,
    eventName: EventTypes.REMOVE_PROPERTY,
    data: [{ id: 'prop-a', type: 'position' }]
  }),
  delivery(SharedDataChannelNames.PROPS, EventTypes.UPDATE_PROPERTY, {
    action: PROPS_ACTIONS.UPDATE_PROPERTY,
    eventName: EventTypes.UPDATE_PROPERTY,
    id: 'prop-a',
    key: 'x',
    before: 0,
    after: 10
  })
]

describe('Asyra Design app-owned collaboration processing', () => {
  it('validates all supported Scene Tree and Props routes before one remote transaction', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn(() => true)
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process
    )
    const deliveries = validDeliveries()

    processPublication(publication(deliveries))

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledTimes(deliveries.length)
    expect(process.mock.calls.map(([event]) => event.type)).toEqual(
      deliveries.map((item) => item.eventName)
    )
  })

  it('rejects the whole publication before remote transaction when one delivery is invalid', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn()
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process
    )
    const deliveries = [
      validDeliveries()[0] as SharedDelivery,
      delivery('unknown-channel', 'unknown-event', { value: 1 })
    ]

    expect(() => processPublication(publication(deliveries))).toThrow(
      'unsupported collaboration delivery'
    )
    expect(runRemoteTransaction).not.toHaveBeenCalled()
    expect(process).not.toHaveBeenCalled()
  })

  it('preserves repeated app intent and delivery order', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn()
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process
    )
    const repeated = validDeliveries()[2] as SharedDelivery

    processPublication(
      publication([
        { ...repeated, deliveryId: 'delivery-a' },
        { ...repeated, deliveryId: 'delivery-b' }
      ])
    )

    expect(process).toHaveBeenCalledTimes(2)
    expect(process.mock.calls[0]?.[0]).toEqual(process.mock.calls[1]?.[0])
  })

  it('rejects malformed hierarchy evidence before the remote transaction', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn()
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process
    )
    const malformed = delivery(
      SharedDataChannelNames.SCENE_TREE,
      EventTypes.MOVE_ELEMENTS,
      {
        action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
        eventName: EventTypes.MOVE_ELEMENTS,
        moves: [
          {
            elementId: 'rect-a',
            before: { parentId: 'workspace-a', index: 0 },
            after: { parentId: 'group-a', index: 0 }
          },
          {
            elementId: 'rect-a',
            before: { parentId: 'workspace-a', index: 1 },
            after: { parentId: 'group-a', index: 1 }
          }
        ]
      }
    )

    expect(() => processPublication(publication([malformed]))).toThrow(
      'unsupported collaboration delivery'
    )
    expect(runRemoteTransaction).not.toHaveBeenCalled()
    expect(process).not.toHaveBeenCalled()
  })

  it('lets app policy reject unauthorized, duplicate, or conflicting publications without mutation', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn()
    const acceptedPublicationIds = new Set<string>()
    const decide = vi.fn((item: SharedPublication) => {
      if (
        item.publicationId.startsWith('unauthorized') ||
        item.publicationId.startsWith('conflicting') ||
        acceptedPublicationIds.has(item.publicationId)
      ) {
        return false
      }
      acceptedPublicationIds.add(item.publicationId)
      return item
    })
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      decide
    )
    const hierarchy = validDeliveries().slice(4, 6)

    processPublication(publication(hierarchy, 'accepted-hierarchy'))
    processPublication(publication(hierarchy, 'accepted-hierarchy'))
    processPublication(publication(hierarchy, 'unauthorized-hierarchy'))
    processPublication(publication(hierarchy, 'conflicting-hierarchy'))

    expect(decide).toHaveBeenCalledTimes(4)
    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledTimes(2)
  })

  it('revalidates an app-transformed conflict decision before canonical apply', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn()
    const replacement = validDeliveries()[4] as SharedDelivery
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      () => publication([replacement], 'app-transformed')
    )

    processPublication(
      publication([validDeliveries()[5] as SharedDelivery], 'conflicting')
    )

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledOnce()
    expect(process.mock.calls[0]?.[0].type).toBe(EventTypes.MOVE_ELEMENTS)
  })
})
