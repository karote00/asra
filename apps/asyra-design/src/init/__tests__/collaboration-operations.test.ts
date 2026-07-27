import {
  Factory,
  LocalSharedDataChannel,
  type SharedDelivery,
  type SharedPublication
} from '@asyra/factory'
import {
  EventTypes,
  TransactionEventTypes,
  subscribeToAddElement,
  subscribeToEventBatches,
  type AllEvent
} from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type PropsRestorePlan,
  type SceneTreeRestorePlan
} from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import {
  createAsyraDesignPublicationProcessor,
  type RemoteRestoreOwnerFacades
} from '../../collaboration/operations'

const delivery = (
  channel: string,
  eventName: string,
  payload: unknown,
  deliveryId = eventName
): SharedDelivery => {
  const artifactId = 'artifact-test'
  const batchId = `batch-${deliveryId}`
  const recordId = `record-${deliveryId}`
  return {
    deliveryId,
    artifactId,
    batchId,
    transactionId: 1,
    origin: 'action',
    kind: 'forward',
    channel,
    eventName,
    payload,
    recordId,
    record: {
      recordId,
      deliveryId,
      occurrence: 1,
      orderedIds: [],
      payload: payload as object,
      inverseEvents: []
    },
    sharedDelivery: 'immediate'
  }
}

const publication = (
  deliveries: readonly SharedDelivery[],
  publicationId = 'publication-a'
): SharedPublication => {
  const artifactId = deliveries[0]?.artifactId ?? `artifact-${publicationId}`
  const groupedBatches: {
    batchId: string
    deliveries: SharedDelivery[]
  }[] = []
  deliveries.forEach((item) => {
    const active = groupedBatches[groupedBatches.length - 1]
    if (active?.batchId === item.batchId) {
      active.deliveries.push(item)
      return
    }
    groupedBatches.push({ batchId: item.batchId, deliveries: [item] })
  })
  return {
    publicationId,
    artifactId,
    transactionId: 1,
    origin: 'action',
    deliveries,
    batches: groupedBatches.map(({ batchId, deliveries: batchDeliveries }) => ({
      batchId,
      sliceId: batchId,
      artifactId: batchDeliveries[0]?.artifactId ?? artifactId,
      transactionId: batchDeliveries[0]?.transactionId ?? 1,
      origin: batchDeliveries[0]?.origin ?? 'action',
      kind: batchDeliveries[0]?.kind ?? 'forward',
      channel: batchDeliveries[0]?.channel ?? '',
      sharedDelivery: batchDeliveries[0]?.sharedDelivery ?? 'immediate',
      deliveries: batchDeliveries,
      records: batchDeliveries.map(({ record }) => record),
      changes: batchDeliveries.map(({ payload }) => payload)
    })),
    deliveryPlan: {
      mode: 'atomic',
      slices: groupedBatches.map(
        ({ batchId, deliveries: batchDeliveries }) => ({
          sliceId: batchId,
          orderedIds: batchDeliveries.map(({ deliveryId }) => deliveryId)
        })
      )
    }
  }
}

const combinePublications = (
  parts: readonly SharedPublication[],
  publicationId: string
): SharedPublication => {
  const first = parts[0]
  if (!first) {
    throw new Error('Combined publication requires at least one part')
  }
  return {
    ...first,
    publicationId,
    deliveries: parts.flatMap(({ deliveries }) => deliveries),
    batches: parts.flatMap(({ batches }) => batches),
    deliveryPlan: {
      mode: 'progressive',
      slices: parts.flatMap(({ deliveryPlan }) => deliveryPlan.slices)
    }
  }
}

const withExplicitCanonicalDeliveryPlan = (
  source: SharedPublication,
  sliceId: string,
  orderedIds: readonly string[]
): SharedPublication => ({
  ...source,
  batches: source.batches.map((batch) => ({
    ...batch,
    sliceId
  })),
  deliveryPlan: {
    mode: 'progressive',
    slices: [{ sliceId, orderedIds }]
  }
})

const canonicalCreationDeliveries = (
  elementIds: readonly string[],
  parentId = 'workspace-a',
  startIndex = 0
): readonly SharedDelivery[] => {
  const properties = elementIds.map((elementId) => ({
    id: `position-${elementId}`,
    type: 'position'
  }))
  const propertiesBatchId = `batch-properties-${elementIds.join('-')}`
  const elementsBatchId = `batch-elements-${elementIds.join('-')}`
  const propertyDelivery = delivery(
    SharedDataChannelNames.PROPS,
    EventTypes.ADD_PROPERTY,
    {
      action: PROPS_ACTIONS.ADD_PROPERTY,
      eventName: EventTypes.ADD_PROPERTY,
      data: properties
    },
    `properties-${elementIds.join('-')}`
  )
  return [
    {
      ...propertyDelivery,
      batchId: propertiesBatchId,
      record: {
        ...propertyDelivery.record,
        orderedIds: [...elementIds]
      }
    },
    ...elementIds.map((elementId, offset) =>
      (() => {
        const elementDelivery = delivery(
          SharedDataChannelNames.SCENE_TREE,
          EventTypes.ADD_ELEMENT,
          {
            action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
            eventName: EventTypes.ADD_ELEMENT,
            data: {
              id: elementId,
              type: 'rect',
              parentId,
              props: { position: `position-${elementId}` }
            },
            parentId,
            index: startIndex + offset
          },
          `element-${elementId}`
        )
        return {
          ...elementDelivery,
          batchId: elementsBatchId,
          record: {
            ...elementDelivery.record,
            orderedIds: [elementId]
          }
        }
      })()
    )
  ]
}

const canonicalContainerCreationDeliveries = (
  elementId: string,
  parentId = 'workspace-a',
  index = 0
): readonly SharedDelivery[] => {
  const propertyIds = [
    `position-${elementId}`,
    `dimension-${elementId}`,
    `transform-${elementId}`,
    `fill-${elementId}`
  ]
  const propertyDelivery = delivery(
    SharedDataChannelNames.PROPS,
    EventTypes.ADD_PROPERTY,
    {
      action: PROPS_ACTIONS.ADD_PROPERTY,
      eventName: EventTypes.ADD_PROPERTY,
      data: propertyIds.map((id) => ({
        id,
        type: id.slice(0, id.indexOf('-'))
      }))
    },
    `container-properties-${elementId}`
  )
  const elementDelivery = delivery(
    SharedDataChannelNames.SCENE_TREE,
    EventTypes.ADD_ELEMENT,
    {
      action: SCENE_TREE_ACTIONS.ADD_ELEMENT,
      eventName: EventTypes.ADD_ELEMENT,
      data: {
        id: elementId,
        type: 'group',
        parentId,
        props: {
          position: propertyIds[0],
          dimension: propertyIds[1],
          transform: propertyIds[2],
          fill: propertyIds[3]
        },
        children: []
      },
      parentId,
      index
    },
    `container-${elementId}`
  )
  return [
    {
      ...propertyDelivery,
      batchId: `batch-container-properties-${elementId}`,
      record: {
        ...propertyDelivery.record,
        orderedIds: [elementId]
      }
    },
    {
      ...elementDelivery,
      batchId: `batch-container-${elementId}`,
      record: {
        ...elementDelivery.record,
        orderedIds: [elementId]
      }
    }
  ]
}

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

const restoreDeliveries = (): readonly SharedDelivery[] => [
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
  const scenePlan = Object.freeze({
    kind: 'scene-tree-restore-plan',
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
  }) satisfies SceneTreeRestorePlan
  const propsPlan = Object.freeze({
    kind: 'props-restore-plan',
    entries: Object.freeze([
      Object.freeze({
        componentId: 'position-group-a',
        strategy: 'materialize' as const
      })
    ]),
    ownerRelations: scenePlan.propertyOwnerRelations
  }) satisfies PropsRestorePlan

  return {
    scenePlan,
    propsPlan,
    owners: {
      preflightRestoreSubtree: vi.fn<
        RemoteRestoreOwnerFacades['preflightRestoreSubtree']
      >(() => scenePlan),
      preflightRestoreProperties: vi.fn<
        RemoteRestoreOwnerFacades['preflightRestoreProperties']
      >(() => propsPlan),
      applyRestoreProperties: vi.fn<
        RemoteRestoreOwnerFacades['applyRestoreProperties']
      >(() => Object.freeze(['position-group-a'])),
      applyRestoreSubtree:
        vi.fn<RemoteRestoreOwnerFacades['applyRestoreSubtree']>()
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
    const { scenePlan, propsPlan, owners } = createRestoreOwners()
    owners.preflightRestoreSubtree.mockImplementation((snapshot) => {
      callOrder.push('preflight-scene')
      expect(snapshot).toEqual(
        expect.objectContaining({
          elementId: 'group-a',
          rootParentChildrenAfter: []
        })
      )
      return scenePlan
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
        expect(ownerRelations).toBe(scenePlan.propertyOwnerRelations)
        return propsPlan
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
    const observedBatches: AllEvent[][] = []
    const subscription = subscribeToEventBatches((events) => {
      if (events.some((event) => event.type === EventTypes.CHANGE_SUBTREE)) {
        observedBatches.push([...events])
      }
    })

    try {
      expect(
        processPublication(publication(restoreDeliveries(), 'restore-group-a'))
      ).toBe(true)
    } finally {
      subscription.unsubscribe()
    }

    expect(callOrder).toEqual([
      'preflight-scene',
      'preflight-props',
      'transaction',
      'apply-props',
      'apply-scene'
    ])
    expect(owners.applyRestoreProperties).toHaveBeenCalledWith(propsPlan)
    expect(owners.applyRestoreSubtree).toHaveBeenCalledWith(scenePlan)
    expect(process).not.toHaveBeenCalled()
    expect(observedBatches).toHaveLength(1)
    expect(observedBatches[0]?.map(({ type }) => type)).toEqual([
      EventTypes.ADD_PROPERTY,
      EventTypes.CHANGE_SUBTREE
    ])
  })

  it('rejects mixed or out-of-order restore deliveries before owner preflight', () => {
    const cases = [
      [
        ...(restoreDeliveries() as SharedDelivery[]),
        validDeliveries()[0] as SharedDelivery
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
    } as SharedDelivery
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
          [propsDelivery as SharedDelivery, malformedScene],
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
    const process = vi.fn((_event: AllEvent) => true)
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

  it('keeps the real Factory remote boundary free of Undo and echo publication', () => {
    const remoteFactory = new Factory()
    const channel = new LocalSharedDataChannel()
    remoteFactory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    const projections: unknown[][] = []
    channel.observeBatch((changes) => projections.push([...changes]))
    const outboundPublications: SharedPublication[] = []
    remoteFactory.subscribeToSharedPublication((item) =>
      outboundPublications.push(item)
    )
    const statuses: { origin: string; status: string }[] = []
    remoteFactory.subscribeToTransactionStatus(({ origin, status }) => {
      statuses.push({ origin, status })
    })
    const processPublication = createAsyraDesignPublicationProcessor(
      remoteFactory.runRemoteTransaction.bind(remoteFactory),
      (event) =>
        remoteFactory.applyRemoteEvent(event, (canonicalEvent) => {
          remoteFactory.updateTransaction({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: canonicalEvent.type,
            payload:
              'payload' in canonicalEvent ? canonicalEvent.payload : undefined,
            options: {
              shared: SharedDataChannelNames.SCENE_TREE,
              undoable: true,
              rollbackable: true
            }
          })
          return true
        })
    )

    expect(
      processPublication(
        publication(
          [validDeliveries()[2] as SharedDelivery],
          'real-factory-remote'
        )
      )
    ).toBe(true)

    expect(projections).toHaveLength(1)
    expect(outboundPublications).toEqual([])
    expect(
      (
        remoteFactory.transact as unknown as {
          undoStack: unknown[]
          redoStack: unknown[]
        }
      ).undoStack
    ).toEqual([])
    expect(
      (
        remoteFactory.transact as unknown as {
          undoStack: unknown[]
          redoStack: unknown[]
        }
      ).redoStack
    ).toEqual([])
    expect(statuses).toContainEqual({
      origin: 'remote',
      status: 'committed'
    })
  })

  it('applies each Factory creation batch through one canonical owner call', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const applyOrder: string[] = []
    const process = vi.fn((event: AllEvent) => {
      applyOrder.push(event.type)
      return true
    })
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) => {
        applyOrder.push(`batch:${elements.length}`)
        return elements.map(({ id }) => id)
      }
    )
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )

    processPublication(
      publication(
        canonicalCreationDeliveries(
          ['rect-a', 'rect-b', 'rect-c'],
          'workspace-a',
          2
        ),
        'creation-a'
      )
    )
    processPublication(
      publication(
        canonicalCreationDeliveries(['rect-d', 'rect-e'], 'workspace-a', 5),
        'creation-b'
      )
    )

    expect(runRemoteTransaction).toHaveBeenCalledTimes(2)
    expect(applyCanonicalCreationBatch).toHaveBeenCalledTimes(2)
    expect(process).not.toHaveBeenCalled()
    expect(applyOrder).toEqual(['batch:3', 'batch:2'])
    expect(applyCanonicalCreationBatch).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          id: 'rect-a',
          parentId: 'workspace-a',
          props: { position: 'position-rect-a' }
        }),
        expect.objectContaining({ id: 'rect-b' }),
        expect.objectContaining({ id: 'rect-c' })
      ],
      [
        { id: 'position-rect-a', type: 'position' },
        { id: 'position-rect-b', type: 'position' },
        { id: 'position-rect-c', type: 'position' }
      ],
      'workspace-a',
      2
    )
    expect(applyCanonicalCreationBatch).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({ id: 'rect-d' }),
        expect.objectContaining({ id: 'rect-e' })
      ],
      [
        { id: 'position-rect-d', type: 'position' },
        { id: 'position-rect-e', type: 'position' }
      ],
      'workspace-a',
      5
    )
  })

  it('applies an explicit progressive canonical slice through direct record evidence', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn((_event: AllEvent) => true)
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) =>
        elements.map(({ id }) => id) as readonly string[]
    )
    const elementIds = ['progressive-direct-a', 'progressive-direct-b']
    const source = publication(
      canonicalCreationDeliveries(elementIds),
      'progressive-direct'
    )
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )

    expect(
      processPublication(
        withExplicitCanonicalDeliveryPlan(
          source,
          'progressive-direct-slice',
          elementIds
        )
      )
    ).toBe(true)

    expect(applyCanonicalCreationBatch).toHaveBeenCalledOnce()
    expect(process).not.toHaveBeenCalled()
  })

  it('applies one source publication container and child creation through canonical batch owners only', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn((_event: AllEvent) => {
      throw new Error('canonical creation reached the single-event owner')
    })
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) =>
        elements.map(({ id }) => id) as readonly string[]
    )
    const container = publication(
      canonicalContainerCreationDeliveries('group-a'),
      'group-creation'
    )
    const children = publication(
      canonicalCreationDeliveries(
        ['group-child-a', 'group-child-b'],
        'group-a'
      ),
      'group-children'
    )
    const combined = combinePublications(
      [container, children],
      'group-and-children'
    )
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )

    expect(processPublication(combined)).toBe(true)

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).not.toHaveBeenCalled()
    expect(applyCanonicalCreationBatch).toHaveBeenCalledTimes(2)
    expect(applyCanonicalCreationBatch).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          id: 'group-a',
          type: 'group',
          parentId: 'workspace-a',
          props: {
            position: 'position-group-a',
            dimension: 'dimension-group-a',
            transform: 'transform-group-a',
            fill: 'fill-group-a'
          }
        })
      ],
      [
        { id: 'position-group-a', type: 'position' },
        { id: 'dimension-group-a', type: 'dimension' },
        { id: 'transform-group-a', type: 'transform' },
        { id: 'fill-group-a', type: 'fill' }
      ],
      'workspace-a',
      0
    )
    expect(applyCanonicalCreationBatch).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({
          id: 'group-child-a',
          parentId: 'group-a'
        }),
        expect.objectContaining({
          id: 'group-child-b',
          parentId: 'group-a'
        })
      ],
      [
        { id: 'position-group-child-a', type: 'position' },
        { id: 'position-group-child-b', type: 'position' }
      ],
      'group-a',
      0
    )
  })

  it('does not infer a canonical creation batch across distinct Factory batch artifacts', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn((_event: AllEvent) => true)
    const applyCanonicalCreationBatch = vi.fn()
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )
    const splitDeliveries = canonicalCreationDeliveries([
      'split-artifact-a',
      'split-artifact-b'
    ]).map((item, index) => ({
      ...item,
      batchId: `split-factory-batch-${index}`
    }))

    processPublication(publication(splitDeliveries, 'split-artifact'))

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(applyCanonicalCreationBatch).not.toHaveBeenCalled()
    expect(process).toHaveBeenCalledTimes(splitDeliveries.length)
  })

  it('preserves each source ADD_ELEMENT observer delivery without repeating canonical mutation', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn((_event: AllEvent) => true)
    const canonicalMutations: string[] = []
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) => {
        canonicalMutations.push(...elements.map(({ id }) => id))
        return elements.map(({ id }) => id)
      }
    )
    const observedElementIds: string[] = []
    const observedElementBatches: string[][] = []
    const subscription = subscribeToAddElement(({ payload }) => {
      const elementId = payload.data.id
      if (
        typeof elementId === 'string' &&
        elementId.startsWith('observer-batch-')
      ) {
        observedElementIds.push(elementId)
      }
    })
    const batchSubscription = subscribeToEventBatches((events) => {
      const elementIds = events.flatMap((event) => {
        if (event.type !== EventTypes.ADD_ELEMENT || !('payload' in event)) {
          return []
        }
        const payload = event.payload as { data?: { id?: unknown } }
        const elementId = payload.data?.id
        if (
          typeof elementId !== 'string' ||
          !elementId.startsWith('observer-batch-')
        ) {
          return []
        }
        return [elementId]
      })
      if (elementIds.length > 0) {
        observedElementBatches.push(elementIds)
      }
    })
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )
    const deliveries = canonicalCreationDeliveries([
      'observer-batch-a',
      'observer-batch-b',
      'observer-batch-c'
    ])

    try {
      processPublication(publication(deliveries, 'observer-batch'))
    } finally {
      subscription.unsubscribe()
      batchSubscription.unsubscribe()
    }

    expect(canonicalMutations).toEqual([
      'observer-batch-a',
      'observer-batch-b',
      'observer-batch-c'
    ])
    expect(observedElementIds).toEqual([
      'observer-batch-a',
      'observer-batch-b',
      'observer-batch-c'
    ])
    expect(observedElementBatches).toEqual([
      ['observer-batch-a', 'observer-batch-b', 'observer-batch-c']
    ])
    expect(process).not.toHaveBeenCalled()
  })

  it('publishes one ordered observer batch after every canonical pair in one source publication commits', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn((_event: AllEvent) => true)
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) =>
        elements.map(({ id }) => id) as readonly string[]
    )
    const first = publication(
      canonicalCreationDeliveries(['multi-pair-a', 'multi-pair-b']),
      'multi-pair-first'
    )
    const second = publication(
      canonicalCreationDeliveries(
        ['multi-pair-c', 'multi-pair-d'],
        'workspace-a',
        2
      ),
      'multi-pair-second'
    )
    const combined = combinePublications(
      [first, second],
      'multi-pair-publication'
    )
    const observedElementBatches: string[][] = []
    const subscription = subscribeToEventBatches((events) => {
      const ids = events.flatMap((event) => {
        if (event.type !== EventTypes.ADD_ELEMENT || !('payload' in event)) {
          return []
        }
        const payload = event.payload as { data?: { id?: unknown } }
        return typeof payload.data?.id === 'string' &&
          payload.data.id.startsWith('multi-pair-')
          ? [payload.data.id]
          : []
      })
      if (ids.length > 0) observedElementBatches.push(ids)
    })
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )

    try {
      expect(processPublication(combined)).toBe(true)
    } finally {
      subscription.unsubscribe()
    }

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(applyCanonicalCreationBatch).toHaveBeenCalledTimes(2)
    expect(process).not.toHaveBeenCalled()
    expect(observedElementBatches).toEqual([
      ['multi-pair-a', 'multi-pair-b', 'multi-pair-c', 'multi-pair-d']
    ])
  })

  it('does not leak observer evidence when a later step rolls back the source publication', () => {
    const first = publication(
      canonicalCreationDeliveries(['no-prefix-a', 'no-prefix-b']),
      'no-prefix-canonical'
    )
    const trailing = publication(
      [validDeliveries()[2] as SharedDelivery],
      'no-prefix-trailing'
    )
    const combined = combinePublications(
      [first, trailing],
      'no-prefix-publication'
    )
    const observed = vi.fn()
    const subscription = subscribeToEventBatches(observed)
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) =>
        elements.map(({ id }) => id) as readonly string[]
    )
    const processPublication = createAsyraDesignPublicationProcessor(
      (mutate) => mutate(),
      () => {
        throw new Error('later remote apply failed')
      },
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )

    try {
      expect(() => processPublication(combined)).toThrow(
        'later remote apply failed'
      )
    } finally {
      subscription.unsubscribe()
    }

    expect(applyCanonicalCreationBatch).toHaveBeenCalledOnce()
    expect(observed).not.toHaveBeenCalled()
  })

  it.each([
    'collaboration:remote-canonical-batch-apply',
    'collaboration:remote-transaction-apply'
  ])(
    'does not let a failing $phaseName timing observer alter remote apply',
    (phaseName) => {
      const runtime = globalThis as typeof globalThis & {
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
      const previousSink = runtime.__asyraBrowserDragPhaseSink
      let committed = false
      const runRemoteTransaction = vi.fn((mutate: () => void) => {
        mutate()
        committed = true
      })
      const process = vi.fn((_event: AllEvent) => true)
      const applyCanonicalCreationBatch = vi.fn(
        (elements: readonly { id: string }[]) =>
          elements.map(({ id }) => id) as readonly string[]
      )
      const processPublication = createAsyraDesignPublicationProcessor(
        runRemoteTransaction,
        process,
        undefined,
        undefined,
        applyCanonicalCreationBatch
      )
      const timingSink = (observedPhaseName: string) => {
        if (observedPhaseName === phaseName) {
          throw new Error(`timing sink failed for ${phaseName}`)
        }
      }
      runtime.__asyraBrowserDragPhaseSink = timingSink

      try {
        expect(() =>
          processPublication(
            publication(
              canonicalCreationDeliveries([
                `timed-observer-${phaseName}-a`,
                `timed-observer-${phaseName}-b`
              ]),
              `timed-observer-batch-${phaseName}`
            )
          )
        ).not.toThrow()
        expect(runtime.__asyraBrowserDragPhaseSink).toBe(timingSink)
      } finally {
        if (previousSink) {
          runtime.__asyraBrowserDragPhaseSink = previousSink
        } else {
          delete runtime.__asyraBrowserDragPhaseSink
        }
      }

      expect(committed).toBe(true)
      expect(applyCanonicalCreationBatch).toHaveBeenCalledOnce()
    }
  )

  it('keeps incomplete and split property evidence on the ordered event route', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn((_event: AllEvent) => true)
    const applyCanonicalCreationBatch = vi.fn()
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )
    const incomplete = canonicalCreationDeliveries([
      'incomplete-owner-a',
      'incomplete-owner-b'
    ])
    const incompleteProperty = incomplete[0] as SharedDelivery
    const incompleteDeliveries = [
      {
        ...incompleteProperty,
        payload: {
          action: PROPS_ACTIONS.ADD_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [{ id: 'unrelated-position', type: 'position' }]
        }
      },
      ...incomplete.slice(1)
    ]
    const split = canonicalCreationDeliveries([
      'split-owner-a',
      'split-owner-b'
    ])
    const splitProperty = split[0] as SharedDelivery
    const splitPropertyPayload = splitProperty.payload as {
      data: readonly { id: string; type: string }[]
    }
    const splitDeliveries = [
      {
        ...splitProperty,
        deliveryId: 'split-properties-a',
        payload: {
          action: PROPS_ACTIONS.ADD_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [splitPropertyPayload.data[0]]
        }
      },
      {
        ...splitProperty,
        deliveryId: 'split-properties-b',
        payload: {
          action: PROPS_ACTIONS.ADD_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [splitPropertyPayload.data[1]]
        }
      },
      ...split.slice(1)
    ]

    processPublication(
      publication(incompleteDeliveries, 'incomplete-owner-evidence')
    )
    processPublication(publication(splitDeliveries, 'split-owner-evidence'))

    expect(applyCanonicalCreationBatch).not.toHaveBeenCalled()
    expect(process.mock.calls.map(([event]) => event.type)).toEqual([
      ...incompleteDeliveries.map(({ eventName }) => eventName),
      ...splitDeliveries.map(({ eventName }) => eventName)
    ])
  })

  it.each([
    {
      name: 'parent',
      mutate: (deliveries: SharedDelivery[]) => {
        const second = deliveries[2] as SharedDelivery
        const payload = second.payload as Record<string, unknown>
        deliveries[2] = {
          ...second,
          payload: {
            ...payload,
            parentId: 'workspace-b',
            data: {
              ...(payload.data as Record<string, unknown>),
              parentId: 'workspace-b'
            }
          }
        }
      }
    },
    {
      name: 'index',
      mutate: (deliveries: SharedDelivery[]) => {
        const second = deliveries[2] as SharedDelivery
        deliveries[2] = {
          ...second,
          payload: {
            ...(second.payload as Record<string, unknown>),
            index: 4
          }
        }
      }
    },
    {
      name: 'metadata',
      mutate: (deliveries: SharedDelivery[]) => {
        deliveries[2] = {
          ...(deliveries[2] as SharedDelivery),
          transactionId: 2
        }
      }
    }
  ])(
    'falls back in source order when canonical batch $name is discontinuous',
    ({ name, mutate }) => {
      const runRemoteTransaction = vi.fn((operation: () => void) => operation())
      const process = vi.fn((_event: AllEvent) => true)
      const applyCanonicalCreationBatch = vi.fn()
      const processPublication = createAsyraDesignPublicationProcessor(
        runRemoteTransaction,
        process,
        undefined,
        undefined,
        applyCanonicalCreationBatch
      )
      const deliveries = [
        ...canonicalCreationDeliveries([
          `discontinuous-${name}-a`,
          `discontinuous-${name}-b`
        ])
      ]
      mutate(deliveries)

      processPublication(publication(deliveries, `discontinuous-${name}`))

      expect(applyCanonicalCreationBatch).not.toHaveBeenCalled()
      expect(process.mock.calls.map(([event]) => event.type)).toEqual(
        deliveries.map(({ eventName }) => eventName)
      )
    }
  )

  it.each([
    {
      name: 'callback failure',
      apply: (elements: readonly { id: string }[], state: string[]) => {
        state.push(...elements.map(({ id }) => id))
        throw new Error('canonical batch callback failed')
      },
      error: 'canonical batch callback failed'
    },
    {
      name: 'wrong ids',
      apply: (elements: readonly { id: string }[], state: string[]) => {
        state.push(...elements.map(({ id }) => id))
        return elements.slice(0, 1).map(({ id }) => id)
      },
      error: 'canonical creation batch did not apply exact ids'
    }
  ])('rolls back every remote prefix after $name', ({ apply, error }) => {
    const state: string[] = []
    const runRemoteTransaction = vi.fn((mutate: () => void) => {
      const before = [...state]
      try {
        return mutate()
      } catch (failure) {
        state.splice(0, state.length, ...before)
        throw failure
      }
    })
    const process = vi.fn((event: AllEvent) => {
      state.push(`event:${event.type}`)
      return true
    })
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) => apply(elements, state) ?? []
    )
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )

    expect(() =>
      processPublication(
        publication(
          canonicalCreationDeliveries(['rollback-a', 'rollback-b']),
          `rollback-${error}`
        )
      )
    ).toThrow(error)
    expect(state).toEqual([])
    expect(runRemoteTransaction).toHaveBeenCalledOnce()
  })

  it('uses the same direct canonical batch boundary for a singleton envelope', () => {
    const runRemoteTransaction = vi.fn((mutate: () => void) => mutate())
    const process = vi.fn((_event: AllEvent) => true)
    const applyCanonicalCreationBatch = vi.fn(
      (elements: readonly { id: string }[]) =>
        elements.map(({ id }) => id) as readonly string[]
    )
    const processPublication = createAsyraDesignPublicationProcessor(
      runRemoteTransaction,
      process,
      undefined,
      undefined,
      applyCanonicalCreationBatch
    )
    const deliveries = canonicalCreationDeliveries(['group-a'])

    processPublication(publication(deliveries, 'singleton-creation'))

    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(applyCanonicalCreationBatch).toHaveBeenCalledOnce()
    expect(process).not.toHaveBeenCalled()
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

    const outcomes = [
      processPublication(publication(hierarchy, 'accepted-hierarchy')),
      processPublication(publication(hierarchy, 'accepted-hierarchy')),
      processPublication(publication(hierarchy, 'unauthorized-hierarchy')),
      processPublication(publication(hierarchy, 'conflicting-hierarchy'))
    ]

    expect(decide).toHaveBeenCalledTimes(4)
    expect(runRemoteTransaction).toHaveBeenCalledOnce()
    expect(process).toHaveBeenCalledTimes(2)
    expect(outcomes).toEqual([true, false, false, false])
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
