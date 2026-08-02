import type {
  SharedPublication,
  SharedPublicationDelivery
} from '@asyra/factory'
import { EventTypes } from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type PreparedPropsRestore,
  type PreparedSceneTreeRestore
} from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignPublicationProcessor } from '../../collaboration/operations'

type TestPublicationDelivery = SharedPublicationDelivery & {
  readonly batchId: string
  readonly channel: string
}

const delivery = (
  channel: string,
  eventName: string,
  payload: unknown,
  deliveryId = eventName
): TestPublicationDelivery => ({
  deliveryId,
  batchId: `batch-${deliveryId}`,
  channel,
  eventName,
  orderedIds: [deliveryId],
  payload
})

const publication = (
  deliveries: readonly TestPublicationDelivery[],
  publicationId = 'publication-a'
): SharedPublication => ({
  publicationId,
  artifactId: `artifact-${publicationId}`,
  transactionId: 1,
  origin: 'action',
  mode: 'atomic',
  slices: [
    {
      sliceId: `slice-${publicationId}`,
      orderedIds: deliveries.map(({ deliveryId }) => deliveryId),
      batches: deliveries.map(({ batchId, channel, ...item }) => ({
        batchId,
        channel,
        deliveries: [item]
      }))
    }
  ]
})

const validDeliveries = (): readonly TestPublicationDelivery[] => [
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
    rootParentChildrenAfter: [],
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

const restoreDeliveries = (): readonly TestPublicationDelivery[] => [
  delivery(SharedDataChannelNames.PROPS, EventTypes.ADD_PROPERTY, {
    action: PROPS_ACTIONS.ADD_PROPERTY,
    undoType: EventTypes.REMOVE_PROPERTY,
    undoAction: PROPS_ACTIONS.REMOVE_PROPERTY,
    eventName: EventTypes.ADD_PROPERTY,
    data: [
      {
        id: 'position-group-a',
        type: 'position',
        x: 12,
        y: 24
      }
    ]
  }),
  delivery(SharedDataChannelNames.SCENE_TREE, EventTypes.CHANGE_SUBTREE, {
    action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
    undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
    eventName: EventTypes.CHANGE_SUBTREE,
    elementId: 'group-a',
    rootParentChildrenAfter: [],
    removed: [
      {
        elementId: 'group-a',
        parentId: 'workspace-a',
        index: 0,
        data: {
          id: 'group-a',
          type: 'group',
          parentId: 'workspace-a',
          children: [],
          props: { position: 'position-group-a' }
        }
      }
    ]
  })
]

const createRestoreOwners = () => {
  const preparedSceneRestore = Object.freeze({
    kind: 'prepared-scene-tree-restore',
    elementId: 'group-a',
    entries: Object.freeze([
      Object.freeze({
        elementId: 'group-a',
        strategy: 'materialize' as const
      })
    ]),
    propertyOwnerRelations: Object.freeze([
      Object.freeze({
        ownerElementId: 'group-a',
        ownerElementType: 'group',
        ownerPropertyName: 'position',
        componentId: 'position-group-a'
      })
    ])
  }) satisfies PreparedSceneTreeRestore
  const preparedPropsRestore = Object.freeze({
    kind: 'prepared-props-restore',
    entries: Object.freeze([
      Object.freeze({
        componentId: 'position-group-a',
        strategy: 'materialize' as const
      })
    ]),
    ownerRelations: preparedSceneRestore.propertyOwnerRelations
  }) satisfies PreparedPropsRestore

  return {
    preparedSceneRestore,
    preparedPropsRestore,
    owners: {
      preflightRestoreSubtree: vi.fn(() => preparedSceneRestore),
      preflightRestoreProperties: vi.fn(() => preparedPropsRestore),
      applyRestoreProperties: vi.fn(() => Object.freeze(['position-group-a'])),
      applyRestoreSubtree: vi.fn()
    }
  }
}

describe('Asyra Design app-owned collaboration processing', () => {
  it('preflights one complete restore before applying Props then Scene in one remote transaction', () => {
    const callOrder: string[] = []
    const runRemoteTransaction = vi.fn((mutate: () => void) => {
      callOrder.push('transaction')
      mutate()
    })
    const process = vi.fn()
    const { preparedSceneRestore, preparedPropsRestore, owners } =
      createRestoreOwners()
    owners.preflightRestoreSubtree.mockImplementation((snapshot) => {
      callOrder.push('preflight-scene')
      expect(snapshot).toEqual(
        expect.objectContaining({
          elementId: 'group-a',
          rootParentChildrenAfter: []
        })
      )
      return preparedSceneRestore
    })
    owners.preflightRestoreProperties.mockImplementation(
      (snapshot, ownerRelations) => {
        callOrder.push('preflight-props')
        expect(snapshot).toEqual({
          components: [
            {
              id: 'position-group-a',
              type: 'position',
              x: 12,
              y: 24
            }
          ]
        })
        expect(ownerRelations).toBe(preparedSceneRestore.propertyOwnerRelations)
        return preparedPropsRestore
      }
    )
    owners.applyRestoreProperties.mockImplementation(() => {
      callOrder.push('apply-props')
      return Object.freeze(['position-group-a'])
    })
    owners.applyRestoreSubtree.mockImplementation(() => {
      callOrder.push('apply-scene')
      return {
        elementId: 'group-a',
        removed: [],
        rootParentChildrenAfter: []
      }
    })
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      (item) => item,
      owners
    )

    processPublication(publication(restoreDeliveries(), 'restore-group-a'))

    expect(callOrder).toEqual([
      'preflight-scene',
      'preflight-props',
      'transaction',
      'apply-props',
      'apply-scene'
    ])
    expect(owners.applyRestoreProperties).toHaveBeenCalledWith(
      preparedPropsRestore
    )
    expect(owners.applyRestoreSubtree).toHaveBeenCalledWith(
      preparedSceneRestore
    )
    expect(process).not.toHaveBeenCalled()
  })

  it('rejects mixed or out-of-order restore deliveries before owner preflight', () => {
    const cases = [
      [
        ...(restoreDeliveries() as TestPublicationDelivery[]),
        validDeliveries()[0] as TestPublicationDelivery
      ],
      [...restoreDeliveries()].reverse()
    ]

    cases.forEach((deliveries, index) => {
      const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
      const process = vi.fn()
      const { owners } = createRestoreOwners()
      const processPublication = createAsyraDesignPublicationProcessor(
        runRemoteTransaction,
        process,
        (item) => item,
        owners
      )

      expect(() =>
        processPublication(publication(deliveries, `invalid-restore-${index}`))
      ).toThrow('invalid subtree restore publication')
      expect(owners.preflightRestoreSubtree).not.toHaveBeenCalled()
      expect(owners.preflightRestoreProperties).not.toHaveBeenCalled()
      expect(runRemoteTransaction).not.toHaveBeenCalled()
      expect(process).not.toHaveBeenCalled()
    })
  })

  it('rejects restore evidence without detached root-parent order before policy or mutation', () => {
    const [propsDelivery, sceneDelivery] = restoreDeliveries()
    const malformedScene = {
      ...sceneDelivery,
      payload: {
        ...(sceneDelivery?.payload as Record<string, unknown>)
      }
    } as TestPublicationDelivery
    delete (malformedScene.payload as Record<string, unknown>)
      .rootParentChildrenAfter
    const decide = vi.fn((item: SharedPublication) => item)
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const { owners } = createRestoreOwners()
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      vi.fn(),
      decide,
      owners
    )

    expect(() =>
      processPublication(
        publication(
          [propsDelivery as TestPublicationDelivery, malformedScene],
          'malformed-root-order'
        )
      )
    ).toThrow('unsupported collaboration delivery')
    expect(decide).not.toHaveBeenCalled()
    expect(owners.preflightRestoreSubtree).not.toHaveBeenCalled()
    expect(runRemoteTransaction).not.toHaveBeenCalled()
  })

  it('rejects restore policy or owner preflight failure before the remote transaction', () => {
    const rejectedOwners = createRestoreOwners().owners
    const rejectedTransaction = vi.fn((mutate: () => void) => mutate())
    const rejectPublication = createAsyraDesignPublicationProcessor(
      rejectedTransaction,
      vi.fn(),
      () => false,
      rejectedOwners
    )

    rejectPublication(
      publication(restoreDeliveries(), 'unauthorized-restore-group-a')
    )

    expect(rejectedOwners.preflightRestoreSubtree).not.toHaveBeenCalled()
    expect(rejectedOwners.preflightRestoreProperties).not.toHaveBeenCalled()
    expect(rejectedTransaction).not.toHaveBeenCalled()

    const staleOwners = createRestoreOwners().owners
    staleOwners.preflightRestoreProperties.mockImplementation(() => {
      throw new Error('stale property owner evidence')
    })
    const staleTransaction = vi.fn((mutate: () => void) => mutate())
    const rejectStale = createAsyraDesignPublicationProcessor(
      staleTransaction,
      vi.fn(),
      (item) => item,
      staleOwners
    )

    expect(() =>
      rejectStale(publication(restoreDeliveries(), 'stale-restore-group-a'))
    ).toThrow('stale property owner evidence')
    expect(staleOwners.preflightRestoreSubtree).toHaveBeenCalledOnce()
    expect(staleOwners.preflightRestoreProperties).toHaveBeenCalledOnce()
    expect(staleOwners.applyRestoreProperties).not.toHaveBeenCalled()
    expect(staleOwners.applyRestoreSubtree).not.toHaveBeenCalled()
    expect(staleTransaction).not.toHaveBeenCalled()
  })

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
      validDeliveries()[0] as TestPublicationDelivery,
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
    const repeated = validDeliveries()[2] as TestPublicationDelivery

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
    const replacement = validDeliveries()[4] as TestPublicationDelivery
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      () => publication([replacement], 'app-transformed')
    )

    processPublication(
      publication(
        [validDeliveries()[5] as TestPublicationDelivery],
        'conflicting'
      )
    )

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledOnce()
    expect(process.mock.calls[0]?.[0].type).toBe(EventTypes.MOVE_ELEMENTS)
  })
})
