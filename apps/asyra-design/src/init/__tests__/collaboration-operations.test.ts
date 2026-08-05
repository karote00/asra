import type { CanonicalChange } from '@asyra/core'
import type {
  SharedPublication,
  SharedPublicationDelivery
} from '@asyra/factory'
import {
  EventTypes,
  getTransactionReplayMode,
  subscribeToEvents,
  type AllEvent
} from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  subscribeToBrowserDragPhases
} from '@asyra/utils'
import { describe, expect, it, vi } from 'vitest'
import {
  applyDocumentSessionBootstrapTail,
  createPublicationProcessor,
  type DecideRemotePublication
} from '../../collaboration/operations'
import {
  createDocumentMaterializationService,
  type DocumentMaterializationStore,
  type MaterializedDocumentRecord
} from '../../../server/document-materializer'

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
  publicationId = 'publication-a',
  origin: SharedPublication['origin'] = 'action'
): SharedPublication => {
  const groupedBatches: {
    batchId: string
    channel: string
    deliveries: SharedPublicationDelivery[]
  }[] = []

  deliveries.forEach(({ batchId, channel, ...item }) => {
    const publicationDelivery =
      origin === 'rollback-compensation'
        ? {
            ...item,
            compensatesDeliveryId: `forward-${item.deliveryId}`
          }
        : item
    const active = groupedBatches[groupedBatches.length - 1]
    if (active?.batchId === batchId) {
      active.deliveries.push(publicationDelivery)
      return
    }
    groupedBatches.push({
      batchId,
      channel,
      deliveries: [publicationDelivery]
    })
  })

  return {
    publicationId,
    artifactId: `artifact-${publicationId}`,
    transactionId: 1,
    origin,
    mode: 'atomic',
    ...(origin === 'rollback-compensation'
      ? { compensatesPublicationId: `forward-${publicationId}` }
      : {}),
    slices: [
      {
        sliceId: `slice-${publicationId}`,
        orderedIds: groupedBatches.flatMap(({ deliveries: batchDeliveries }) =>
          batchDeliveries.map(({ deliveryId }) => deliveryId)
        ),
        batches: groupedBatches
      }
    ]
  }
}

const withExplicitCanonicalDeliverySequence = (
  source: SharedPublication,
  sliceId: string,
  orderedIds: readonly string[]
): SharedPublication => ({
  ...source,
  mode: 'progressive',
  slices: [
    {
      sliceId,
      orderedIds,
      batches: source.slices.flatMap(({ batches }) => batches)
    }
  ]
})

const canonicalCreationDeliveries = (
  elementIds: readonly string[],
  parentId = 'workspace-a',
  startIndex = 0
): readonly TestPublicationDelivery[] => {
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

  const elementDelivery = delivery(
    SharedDataChannelNames.SCENE_TREE,
    EventTypes.ADD_ELEMENTS,
    {
      action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
      eventName: EventTypes.ADD_ELEMENTS,
      undoType: EventTypes.REMOVE_ELEMENTS,
      undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
      entries: elementIds.map((elementId, offset) => ({
        data: {
          id: elementId,
          type: 'rect',
          parentId,
          props: { position: `position-${elementId}` }
        },
        parentId,
        index: startIndex + offset
      }))
    },
    `elements-${elementIds.join('-')}`
  )

  return [
    {
      ...propertyDelivery,
      batchId: propertiesBatchId,
      orderedIds: [...elementIds]
    },
    {
      ...elementDelivery,
      batchId: elementsBatchId,
      orderedIds: [...elementIds]
    }
  ]
}

const canonicalContainerCreationDeliveries = (
  elementId: string,
  parentId = 'workspace-a',
  index = 0
): readonly TestPublicationDelivery[] => {
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
      orderedIds: [elementId]
    },
    {
      ...elementDelivery,
      batchId: `batch-container-${elementId}`,
      orderedIds: [elementId]
    }
  ]
}

const canonicalRemovalDeliveries = (
  elementIds: readonly string[],
  includePropertyEvidence: boolean
): readonly TestPublicationDelivery[] => {
  const removalIds = [...elementIds].reverse()
  const sceneBatchId = `batch-remove-elements-${elementIds.join('-')}`
  const propsBatchId = `batch-remove-properties-${elementIds.join('-')}`
  const sceneDelivery = delivery(
    SharedDataChannelNames.SCENE_TREE,
    EventTypes.REMOVE_ELEMENTS,
    {
      action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
      eventName: EventTypes.REMOVE_ELEMENTS,
      undoType: EventTypes.ADD_ELEMENTS,
      undoAction: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
      entries: elementIds.map((elementId, index) => ({
        data: {
          id: elementId,
          type: elementId.startsWith('group') ? 'group' : 'rect',
          parentId: 'workspace-a',
          props: { position: `position-${elementId}` },
          ...(elementId.startsWith('group') ? { children: [] } : {})
        },
        parentId: 'workspace-a',
        index
      }))
    },
    `remove-elements-${elementIds.join('-')}`
  )
  const sceneDeliveries = [
    {
      ...sceneDelivery,
      batchId: sceneBatchId,
      orderedIds: removalIds
    }
  ]
  if (!includePropertyEvidence) {
    return sceneDeliveries
  }

  const propertyDeliveries = removalIds.map((elementId) => {
    const propertyDelivery = delivery(
      SharedDataChannelNames.PROPS,
      EventTypes.REMOVE_PROPERTY,
      {
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        eventName: EventTypes.REMOVE_PROPERTY,
        data: [{ id: `position-${elementId}`, type: 'position' }]
      },
      `remove-properties-${elementId}`
    )
    return {
      ...propertyDelivery,
      batchId: propsBatchId,
      orderedIds: [elementId]
    }
  })
  return [...sceneDeliveries, ...propertyDeliveries]
}

const propertyUpdateDeliveries = (
  propertyId: string,
  values: Readonly<Record<string, unknown>>
): readonly TestPublicationDelivery[] => {
  const batchId = `batch-update-${propertyId}`
  return Object.entries(values).map(([key, after]) => {
    const item = delivery(
      SharedDataChannelNames.PROPS,
      EventTypes.UPDATE_PROPERTY,
      {
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        eventName: EventTypes.UPDATE_PROPERTY,
        id: propertyId,
        key,
        before: 0,
        after
      },
      `update-${propertyId}-${key}`
    )
    return { ...item, batchId }
  })
}

const subtreeRemovalDelivery = (): TestPublicationDelivery =>
  delivery(
    SharedDataChannelNames.SCENE_TREE,
    EventTypes.CHANGE_SUBTREE,
    {
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
          data: {
            id: 'rect-a',
            type: 'rect',
            parentId: 'group-a'
          }
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
    },
    'remove-subtree-group-a'
  )

const restoreDeliveries = (): readonly TestPublicationDelivery[] => [
  delivery(
    SharedDataChannelNames.PROPS,
    EventTypes.ADD_PROPERTY,
    {
      action: PROPS_ACTIONS.ADD_PROPERTY,
      eventName: EventTypes.ADD_PROPERTY,
      data: [
        {
          id: 'position-group-a',
          type: 'position',
          x: 12,
          y: 24
        }
      ]
    },
    'restore-property-group-a'
  ),
  delivery(
    SharedDataChannelNames.SCENE_TREE,
    EventTypes.CHANGE_SUBTREE,
    {
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
    },
    'restore-subtree-group-a'
  )
]

interface HarnessOptions {
  readonly runRemoteTransaction?: (mutate: () => void) => void
  readonly decideRemotePublication?: DecideRemotePublication
  readonly applyCanonicalChanges?: (changes: readonly CanonicalChange[]) => void
}

const createHarness = (options: HarnessOptions = {}) => {
  const runRemoteTransaction = vi.fn<(mutate: () => void) => void>(
    options.runRemoteTransaction ?? ((mutate) => mutate())
  )
  const decideRemotePublication = vi.fn<DecideRemotePublication>(
    options.decideRemotePublication ?? ((item) => item)
  )
  const applyCanonicalChanges = vi.fn<
    (changes: readonly CanonicalChange[]) => void
  >(options.applyCanonicalChanges ?? (() => undefined))
  const processPublication = createPublicationProcessor({
    runRemoteTransaction,
    decideRemotePublication,
    applyCanonicalChanges
  })

  return {
    applyCanonicalChanges,
    decideRemotePublication,
    processPublication,
    runRemoteTransaction
  }
}

describe('Asyra Design app-owned collaboration processing', () => {
  it('applies a gap-free bootstrap tail exactly once in document sequence order', async () => {
    const first = publication(
      propertyUpdateDeliveries('position-a', { x: 10 }),
      'bootstrap-publication-1'
    )
    const second = publication(
      propertyUpdateDeliveries('position-a', { x: 20 }),
      'bootstrap-publication-2'
    )
    const applied: string[] = []

    await expect(
      applyDocumentSessionBootstrapTail({
        bootstrap: {
          checkpoint: { version: '1.0.0' },
          durableSequence: 4,
          headSequence: 6,
          pendingTail: [
            { sequence: 5, publication: first, fromActorId: 'actor-a' },
            { sequence: 6, publication: second, fromActorId: 'actor-b' }
          ]
        },
        applyPublication: async (item) => {
          applied.push(item.publicationId)
        }
      })
    ).resolves.toBe(6)
    expect(applied).toEqual([
      'bootstrap-publication-1',
      'bootstrap-publication-2'
    ])
  })

  it('rejects bootstrap gaps, duplicate publication identities, and invalid routes before apply', async () => {
    const valid = publication(
      propertyUpdateDeliveries('position-a', { x: 10 }),
      'bootstrap-valid'
    )
    const invalidRoute = publication(
      [delivery('selection', 'selection.update', {})],
      'bootstrap-invalid-route'
    )
    const applyPublication = vi.fn(async () => undefined)

    for (const pendingTail of [
      [
        { sequence: 2, publication: valid, fromActorId: 'actor-a' },
        { sequence: 4, publication: valid, fromActorId: 'actor-a' }
      ],
      [
        { sequence: 2, publication: valid, fromActorId: 'actor-a' },
        { sequence: 3, publication: valid, fromActorId: 'actor-b' }
      ],
      [
        { sequence: 2, publication: valid, fromActorId: 'actor-a' },
        { sequence: 3, publication: invalidRoute, fromActorId: 'actor-b' }
      ]
    ]) {
      await expect(
        applyDocumentSessionBootstrapTail({
          bootstrap: {
            checkpoint: { version: '1.0.0' },
            durableSequence: 1,
            headSequence: 3,
            pendingTail
          },
          applyPublication
        })
      ).rejects.toThrow(/bootstrap|unsupported collaboration delivery/)
    }
    expect(applyPublication).not.toHaveBeenCalled()
  })

  it('applies a minimal nested property publication without legacy aliases', () => {
    const harness = createHarness()
    const minimalPublication: SharedPublication = {
      publicationId: 'minimal-property-update',
      artifactId: 'artifact-minimal-property-update',
      transactionId: 1,
      origin: 'action',
      mode: 'atomic',
      slices: [
        {
          sliceId: 'slice-minimal-property-update',
          orderedIds: ['delivery-minimal-property-update'],
          batches: [
            {
              batchId: 'batch-minimal-property-update',
              channel: SharedDataChannelNames.PROPS,
              deliveries: [
                {
                  deliveryId: 'delivery-minimal-property-update',
                  eventName: EventTypes.UPDATE_PROPERTY,
                  orderedIds: ['element-a'],
                  payload: {
                    action: PROPS_ACTIONS.UPDATE_PROPERTY,
                    eventName: EventTypes.UPDATE_PROPERTY,
                    id: 'position-a',
                    key: 'x',
                    before: 0,
                    after: 10
                  }
                }
              ]
            }
          ]
        }
      ]
    }

    expect(harness.processPublication(minimalPublication)).toBe(true)
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'property-components',
        updates: [{ propertyId: 'position-a', values: { x: 10 } }]
      }
    ])
  })

  it('rejects remote computed projection before policy or mutation', () => {
    const harness = createHarness()
    const computed = delivery(
      SharedDataChannelNames.SCENE_TREE,
      EventTypes.UPDATE_COMPUTED_DATA,
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        id: 'rect-a',
        changes: [{ owner: 'computed', key: 'x', before: 0, after: 10 }]
      },
      'computed-rect-a'
    )

    expect(() =>
      harness.processPublication(
        publication([computed], 'remote-computed-projection')
      )
    ).toThrow(/local-only computed projection/i)
    expect(harness.decideRemotePublication).not.toHaveBeenCalled()
    expect(harness.runRemoteTransaction).not.toHaveBeenCalled()
    expect(harness.applyCanonicalChanges).not.toHaveBeenCalled()
  })

  it('coalesces one property batch into one remote transaction and one Core request', () => {
    const harness = createHarness()

    expect(
      harness.processPublication(
        publication(
          propertyUpdateDeliveries('position-a', { x: 10, y: 20 }),
          'remote-property-batch'
        )
      )
    ).toBe(true)

    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'property-components',
        updates: [
          {
            propertyId: 'position-a',
            values: { x: 10, y: 20 }
          }
        ]
      }
    ])
  })

  it('preserves exact property record additions before updates in one Core request', () => {
    const harness = createHarness()
    const propertyBatchId = 'batch-vector-topology'
    const pointAddition = {
      ...delivery(
        SharedDataChannelNames.PROPS,
        EventTypes.ADD_PROPERTY,
        {
          action: PROPS_ACTIONS.ADD_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [{ id: 'point-b', type: 'vectorPoint', x: 20, y: 30 }]
        },
        'add-point-b'
      ),
      batchId: propertyBatchId,
      orderedIds: ['points-root']
    }
    const pointRootUpdate = {
      ...delivery(
        SharedDataChannelNames.PROPS,
        EventTypes.UPDATE_PROPERTY,
        {
          action: PROPS_ACTIONS.UPDATE_PROPERTY,
          eventName: EventTypes.UPDATE_PROPERTY,
          id: 'points-root',
          key: 'points',
          before: ['point-a'],
          after: ['point-a', 'point-b']
        },
        'update-points-root'
      ),
      batchId: propertyBatchId,
      orderedIds: ['points-root']
    }

    expect(
      harness.processPublication(
        publication([pointAddition, pointRootUpdate], 'remote-vector-topology')
      )
    ).toBe(true)

    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'property-components',
        records: [
          {
            propertyId: 'points-root',
            key: 'points',
            set: {
              'point-b': {
                id: 'point-b',
                type: 'vectorPoint',
                x: 20,
                y: 30
              }
            }
          }
        ],
        updates: []
      }
    ])
  })

  it('preserves exact property record removals before updates in one Core request', () => {
    const harness = createHarness()
    const propertyBatchId = 'batch-vector-topology-removal'
    const pointRemoval = {
      ...delivery(
        SharedDataChannelNames.PROPS,
        EventTypes.REMOVE_PROPERTY,
        {
          action: PROPS_ACTIONS.REMOVE_PROPERTY,
          eventName: EventTypes.REMOVE_PROPERTY,
          data: [{ id: 'point-b', type: 'vectorPoint', x: 20, y: 30 }]
        },
        'remove-point-b'
      ),
      batchId: propertyBatchId,
      orderedIds: ['points-root']
    }
    const pointRootUpdate = {
      ...delivery(
        SharedDataChannelNames.PROPS,
        EventTypes.UPDATE_PROPERTY,
        {
          action: PROPS_ACTIONS.UPDATE_PROPERTY,
          eventName: EventTypes.UPDATE_PROPERTY,
          id: 'points-root',
          key: 'points',
          before: ['point-a', 'point-b'],
          after: ['point-a']
        },
        'update-points-root-after-removal'
      ),
      batchId: propertyBatchId,
      orderedIds: ['points-root']
    }

    expect(
      harness.processPublication(
        publication(
          [pointRootUpdate, pointRemoval],
          'remote-vector-topology-removal'
        )
      )
    ).toBe(true)
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'property-components',
        records: [
          {
            propertyId: 'points-root',
            key: 'points',
            remove: ['point-b']
          }
        ],
        updates: []
      }
    ])
  })

  it('preserves one property record replacement with one relationship update', () => {
    const harness = createHarness()
    const propertyBatchId = 'batch-vector-topology-replacement'
    const segmentAddition = {
      ...delivery(
        SharedDataChannelNames.PROPS,
        EventTypes.ADD_PROPERTY,
        {
          action: PROPS_ACTIONS.ADD_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [
            {
              id: 'segment-new',
              type: 'vectorSegment',
              startId: 'point-a',
              endId: 'point-b'
            }
          ]
        },
        'add-segment-new'
      ),
      batchId: propertyBatchId,
      orderedIds: ['segments-root']
    }
    const segmentRootUpdate = {
      ...delivery(
        SharedDataChannelNames.PROPS,
        EventTypes.UPDATE_PROPERTY,
        {
          action: PROPS_ACTIONS.UPDATE_PROPERTY,
          eventName: EventTypes.UPDATE_PROPERTY,
          id: 'segments-root',
          key: 'segments',
          before: ['segment-old'],
          after: ['segment-new']
        },
        'replace-segments-root'
      ),
      batchId: propertyBatchId,
      orderedIds: ['segments-root']
    }
    const segmentRemoval = {
      ...delivery(
        SharedDataChannelNames.PROPS,
        EventTypes.REMOVE_PROPERTY,
        {
          action: PROPS_ACTIONS.REMOVE_PROPERTY,
          eventName: EventTypes.REMOVE_PROPERTY,
          data: [
            {
              id: 'segment-old',
              type: 'vectorSegment',
              startId: 'point-a',
              endId: 'point-b'
            }
          ]
        },
        'remove-segment-old'
      ),
      batchId: propertyBatchId,
      orderedIds: ['segments-root']
    }

    expect(
      harness.processPublication(
        publication(
          [segmentAddition, segmentRootUpdate, segmentRemoval],
          'remote-vector-topology-replacement'
        )
      )
    ).toBe(true)
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'property-components',
        records: [
          {
            propertyId: 'segments-root',
            key: 'segments',
            set: {
              'segment-new': {
                id: 'segment-new',
                type: 'vectorSegment',
                startId: 'point-a',
                endId: 'point-b'
              }
            },
            remove: ['segment-old']
          }
        ],
        updates: []
      }
    ])
  })

  it('preserves mixed canonical batch order in one Core request', () => {
    const harness = createHarness()
    const hierarchy = delivery(
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
          }
        ]
      },
      'move-rect-a'
    )
    const remote = publication(
      [
        ...canonicalContainerCreationDeliveries('group-a'),
        ...canonicalCreationDeliveries(['rect-a', 'rect-b'], 'group-a'),
        ...propertyUpdateDeliveries('position-rect-a', { x: 30 }),
        hierarchy
      ],
      'mixed-canonical-request'
    )

    expect(harness.processPublication(remote)).toBe(true)
    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()

    const changes = harness.applyCanonicalChanges.mock.calls[0]?.[0]
    expect(changes?.map(({ kind }) => kind)).toEqual([
      'element-creation',
      'element-creation',
      'property-components',
      'hierarchy-moves'
    ])
    expect(changes?.[0]).toMatchObject({
      kind: 'element-creation',
      parentId: 'workspace-a',
      index: 0,
      elements: [{ id: 'group-a' }]
    })
    expect(changes?.[1]).toMatchObject({
      kind: 'element-creation',
      parentId: 'group-a',
      index: 0,
      elements: [{ id: 'rect-a' }, { id: 'rect-b' }]
    })
  })

  it('accepts hierarchy moves whose Factory delivery has no canonical ordered IDs', () => {
    const harness = createHarness()
    const hierarchy = {
      ...delivery(
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
            }
          ]
        },
        'move-rect-a-without-ordered-ids'
      ),
      orderedIds: []
    }

    expect(
      harness.processPublication(
        publication([hierarchy], 'hierarchy-without-ordered-ids')
      )
    ).toBe(true)
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'hierarchy-moves',
        moves: [
          {
            elementId: 'rect-a',
            before: { parentId: 'workspace-a', index: 0 },
            after: { parentId: 'group-a', index: 0 }
          }
        ]
      }
    ])
  })

  it('preserves creation before hierarchy moves recorded in the same Scene batch', () => {
    const harness = createHarness()
    const groupCreation = canonicalContainerCreationDeliveries('group-a')
    const sceneCreation = groupCreation[1]
    if (!sceneCreation) throw new Error('Expected Group Scene creation')
    const hierarchy = {
      ...delivery(
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
            }
          ]
        },
        'move-rect-a-into-created-group'
      ),
      batchId: sceneCreation.batchId,
      orderedIds: []
    }

    expect(
      harness.processPublication(
        publication(
          [...groupCreation, hierarchy],
          'group-creation-with-hierarchy-move'
        )
      )
    ).toBe(true)
    expect(
      harness.applyCanonicalChanges.mock.calls[0]?.[0].map(({ kind }) => kind)
    ).toEqual(['element-creation', 'hierarchy-moves'])
  })

  it('preserves hierarchy moves before removal recorded in the same Scene batch', () => {
    const harness = createHarness()
    const removal = canonicalRemovalDeliveries(['group-a'], true)
    const sceneRemoval = removal[0]
    if (!sceneRemoval) throw new Error('Expected Group Scene removal')
    const hierarchy = {
      ...delivery(
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.MOVE_ELEMENTS,
        {
          action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
          eventName: EventTypes.MOVE_ELEMENTS,
          moves: [
            {
              elementId: 'rect-a',
              before: { parentId: 'group-a', index: 0 },
              after: { parentId: 'workspace-a', index: 0 }
            }
          ]
        },
        'move-rect-a-out-of-removed-group'
      ),
      batchId: sceneRemoval.batchId,
      orderedIds: []
    }

    expect(
      harness.processPublication(
        publication(
          [hierarchy, ...removal],
          'hierarchy-move-before-group-removal'
        )
      )
    ).toBe(true)
    expect(
      harness.applyCanonicalChanges.mock.calls[0]?.[0].map(({ kind }) => kind)
    ).toEqual(['hierarchy-moves', 'element-removal'])
  })

  it('organizes each source publication topology exactly once', () => {
    const source = publication(
      [
        ...canonicalContainerCreationDeliveries('group-a'),
        ...canonicalCreationDeliveries(['rect-a', 'rect-b'], 'group-a'),
        ...propertyUpdateDeliveries('position-rect-a', { x: 30, y: 40 })
      ],
      'single-linear-organization'
    )
    let publicationTopologyReads = 0
    let sliceTopologyReads = 0
    const observedSlices = source.slices.map((slice) => {
      const sourceBatches = slice.batches
      return {
        ...slice,
        get batches() {
          sliceTopologyReads += 1
          return sourceBatches
        }
      }
    })
    const observedPublication: SharedPublication = {
      ...source,
      get slices() {
        publicationTopologyReads += 1
        return observedSlices
      }
    }
    const harness = createHarness()

    expect(harness.processPublication(observedPublication)).toBe(true)
    expect(publicationTopologyReads).toBe(1)
    expect(sliceTopologyReads).toBe(observedSlices.length)
    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
  })

  it('does not republish inbound raw events after Core accepts the request', () => {
    const markerPropertyId = 'raw-republish-marker'
    const observedRawEvents: AllEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type === EventTypes.UPDATE_PROPERTY &&
        'payload' in event &&
        (event.payload as { id?: unknown }).id === markerPropertyId
      ) {
        observedRawEvents.push(event)
      }
    })
    const harness = createHarness()

    try {
      expect(
        harness.processPublication(
          publication(
            propertyUpdateDeliveries(markerPropertyId, { x: 10 }),
            'no-raw-republish'
          )
        )
      ).toBe(true)
    } finally {
      subscription.unsubscribe()
    }

    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    expect(observedRawEvents).toEqual([])
  })

  it('classifies one restore envelope as one Core canonical change', () => {
    const harness = createHarness()

    expect(
      harness.processPublication(
        publication(restoreDeliveries(), 'restore-group-a', 'undo')
      )
    ).toBe(true)

    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'subtree-restore',
        sceneSnapshot: {
          elementId: 'group-a',
          rootParentChildrenAfter: [],
          removed: [
            expect.objectContaining({
              elementId: 'group-a',
              parentId: 'workspace-a'
            })
          ]
        },
        propsSnapshot: {
          components: [
            expect.objectContaining({
              id: 'position-group-a',
              type: 'position'
            })
          ]
        }
      }
    ])
  })

  it('keeps shared property graphs out of a Scene-only subtree removal request', () => {
    const harness = createHarness()

    expect(
      harness.processPublication(
        publication([subtreeRemovalDelivery()], 'shared-subtree-removal')
      )
    ).toBe(true)

    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'subtree-removal',
        change: expect.objectContaining({ elementId: 'group-a' })
      })
    ])
  })

  it('keeps replay mutation options out of canonical subtree evidence', () => {
    const harness = createHarness()
    const removal = subtreeRemovalDelivery()

    expect(
      harness.processPublication(
        publication(
          [
            {
              ...removal,
              payload: {
                ...(removal.payload as Record<string, unknown>),
                options: {
                  undoable: false,
                  rollbackable: true,
                  sharedDelivery: 'transaction-end'
                }
              }
            }
          ],
          'replayed-subtree-removal'
        )
      )
    ).toBe(true)

    const canonicalChange = harness.applyCanonicalChanges.mock.calls[0]?.[0][0]
    expect(canonicalChange).toMatchObject({
      kind: 'subtree-removal',
      change: expect.objectContaining({ elementId: 'group-a' })
    })
    expect(
      (canonicalChange as { change?: Record<string, unknown> }).change
    ).not.toHaveProperty('options')
  })

  it('classifies the retained Group plus 16-item removal fixture once', () => {
    const harness = createHarness()
    const elementIds = [
      'group-retained',
      ...Array.from({ length: 16 }, (_, index) => `rect-${index + 1}`)
    ]
    const expectedRemovalOrder = [...elementIds].reverse()

    expect(
      harness.processPublication(
        publication(
          canonicalRemovalDeliveries(elementIds, false),
          'retained-16-item-removal',
          'undo'
        )
      )
    ).toBe(true)

    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    const [change] = harness.applyCanonicalChanges.mock.calls[0]?.[0] ?? []
    expect(change?.kind).toBe('element-removal')
    if (change?.kind !== 'element-removal') {
      throw new Error('Expected one canonical element-removal change')
    }
    expect(change.removals.map(({ data }) => data.id)).toEqual(
      expectedRemovalOrder
    )
  })

  it('accepts complete ordered property evidence for one remote element removal request', () => {
    const harness = createHarness()
    const elementIds = ['rect-a', 'rect-b']

    expect(
      harness.processPublication(
        publication(
          canonicalRemovalDeliveries(elementIds, true),
          'complete-element-removal'
        )
      )
    ).toBe(true)

    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'element-removal',
        removals: [...elementIds].reverse().map((elementId) =>
          expect.objectContaining({
            data: expect.objectContaining({ id: elementId })
          })
        )
      })
    ])
  })

  it('coalesces adjacent removal batches from one publication into one canonical request', () => {
    const harness = createHarness()

    expect(
      harness.processPublication(
        publication(
          [
            ...canonicalRemovalDeliveries(['rect-a', 'rect-b'], true),
            ...canonicalRemovalDeliveries(['rect-c', 'rect-d'], true)
          ],
          'adjacent-element-removals',
          'undo'
        )
      )
    ).toBe(true)

    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'element-removal',
        removals: [
          expect.objectContaining({
            data: expect.objectContaining({ id: 'rect-b' })
          }),
          expect.objectContaining({
            data: expect.objectContaining({ id: 'rect-a' })
          }),
          expect.objectContaining({
            data: expect.objectContaining({ id: 'rect-d' })
          }),
          expect.objectContaining({
            data: expect.objectContaining({ id: 'rect-c' })
          })
        ]
      }
    ])
  })

  it('preserves a container removal as a canonical batch barrier', () => {
    const harness = createHarness()

    expect(
      harness.processPublication(
        publication(
          [
            ...canonicalRemovalDeliveries(['rect-a'], true),
            ...canonicalRemovalDeliveries(['group-a'], true)
          ],
          'container-removal-barrier',
          'undo'
        )
      )
    ).toBe(true)

    expect(
      harness.applyCanonicalChanges.mock.calls[0]?.[0].map((change) => ({
        ids:
          change.kind === 'element-removal'
            ? change.removals.map(({ data }) => data.id)
            : [],
        kind: change.kind
      }))
    ).toEqual([
      { ids: ['rect-a'], kind: 'element-removal' },
      { ids: ['group-a'], kind: 'element-removal' }
    ])
  })

  it('uses the same one-request boundary for a progressive canonical slice', () => {
    const harness = createHarness()
    const elementIds = ['rect-a', 'rect-b', 'rect-c']
    const progressive = withExplicitCanonicalDeliverySequence(
      publication(
        canonicalCreationDeliveries(elementIds),
        'progressive-creation'
      ),
      'slice-progressive-1',
      elementIds
    )

    expect(harness.processPublication(progressive)).toBe(true)
    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'element-creation',
        elements: elementIds.map((id) => expect.objectContaining({ id }))
      })
    ])
  })

  it('applies one bounded progressive publication window in one remote transaction', () => {
    const harness = createHarness()
    const firstElementIds = ['rect-a', 'rect-b']
    const secondElementIds = ['rect-c', 'rect-d']
    const first = publication(
      canonicalCreationDeliveries(firstElementIds, 'workspace-a', 0),
      'progressive-window-first'
    )
    const second = publication(
      canonicalCreationDeliveries(secondElementIds, 'workspace-a', 2),
      'progressive-window-second'
    )
    const window: SharedPublication = {
      ...first,
      publicationId: 'progressive-window',
      mode: 'progressive',
      slices: [
        {
          sliceId: 'progressive-window-slice-1',
          orderedIds: firstElementIds,
          batches: first.slices.flatMap(({ batches }) => batches)
        },
        {
          sliceId: 'progressive-window-slice-2',
          orderedIds: secondElementIds,
          batches: second.slices.flatMap(({ batches }) => batches)
        }
      ]
    }

    expect(harness.processPublication(window)).toBe(true)
    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'element-creation',
        elements: firstElementIds.map((id) => expect.objectContaining({ id }))
      }),
      expect.objectContaining({
        kind: 'element-creation',
        elements: secondElementIds.map((id) => expect.objectContaining({ id }))
      })
    ])
  })

  it('does not merge different source publications', () => {
    const harness = createHarness()

    expect(
      harness.processPublication(
        publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'publication-one'
        )
      )
    ).toBe(true)
    expect(
      harness.processPublication(
        publication(
          propertyUpdateDeliveries('position-b', { x: 20 }),
          'publication-two'
        )
      )
    ).toBe(true)

    expect(harness.runRemoteTransaction).toHaveBeenCalledTimes(2)
    expect(harness.applyCanonicalChanges).toHaveBeenCalledTimes(2)
  })

  it('lets App policy reject a publication without mutation', () => {
    const harness = createHarness({
      decideRemotePublication: () => false
    })

    expect(
      harness.processPublication(
        publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'policy-rejected'
        )
      )
    ).toBe(false)
    expect(harness.runRemoteTransaction).not.toHaveBeenCalled()
    expect(harness.applyCanonicalChanges).not.toHaveBeenCalled()
  })

  it('revalidates and applies the App-transformed publication', () => {
    const transformed = publication(
      propertyUpdateDeliveries('position-authorized', { x: 40 }),
      'transformed-publication'
    )
    const harness = createHarness({
      decideRemotePublication: () => transformed
    })

    expect(
      harness.processPublication(
        publication(
          propertyUpdateDeliveries('position-inbound', { x: 10 }),
          'inbound-publication'
        )
      )
    ).toBe(true)
    expect(harness.applyCanonicalChanges).toHaveBeenCalledWith([
      {
        kind: 'property-components',
        updates: [
          {
            propertyId: 'position-authorized',
            values: { x: 40 }
          }
        ]
      }
    ])
  })

  it.each([
    ['undo', 'undo'],
    ['redo', 'redo'],
    ['rollback-compensation', 'rollback']
  ] as const)(
    'applies %s through the matching transaction replay mode',
    (origin, expectedReplayMode) => {
      const observedModes: (string | null)[] = []
      const harness = createHarness({
        applyCanonicalChanges: () => {
          observedModes.push(getTransactionReplayMode())
        }
      })

      expect(
        harness.processPublication(
          publication(
            propertyUpdateDeliveries('position-a', { x: 10 }),
            `replay-${origin}`,
            origin
          )
        )
      ).toBe(true)
      expect(observedModes).toEqual([expectedReplayMode])
      expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    }
  )

  it('propagates a Core apply failure through the remote transaction', () => {
    const harness = createHarness({
      applyCanonicalChanges: () => {
        throw new Error('canonical apply failed')
      }
    })

    expect(() =>
      harness.processPublication(
        publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'core-failure'
        )
      )
    ).toThrow('canonical apply failed')
    expect(harness.runRemoteTransaction).toHaveBeenCalledOnce()
    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
  })

  it('isolates diagnostic timing observer failures from canonical settlement', () => {
    const unsubscribe = subscribeToBrowserDragPhases(() => {
      throw new Error('diagnostic sink failed')
    })
    const harness = createHarness()

    try {
      expect(
        harness.processPublication(
          publication(
            propertyUpdateDeliveries('position-a', { x: 10 }),
            'timing-observer-failure'
          )
        )
      ).toBe(true)
    } finally {
      unsubscribe()
    }

    expect(harness.applyCanonicalChanges).toHaveBeenCalledOnce()
  })

  it.each([
    [
      'missing direct Factory batches',
      false,
      () => ({
        ...publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'missing-batches'
        ),
        slices: []
      })
    ],
    [
      'duplicate batch identity',
      false,
      () => {
        const source = publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'inconsistent-artifact'
        )
        const firstSlice = source.slices[0]
        if (!firstSlice) throw new Error('Expected publication slice')
        return {
          ...source,
          slices: [
            firstSlice,
            {
              ...firstSlice,
              sliceId: `${firstSlice.sliceId}:duplicate`
            }
          ]
        }
      }
    ],
    [
      'split canonical creation kinds',
      true,
      () => {
        const source = publication(
          canonicalCreationDeliveries(['rect-a']),
          'split-creation'
        )
        const propertyBatch = source.slices[0]?.batches[0]
        const sceneBatch = source.slices[0]?.batches[1]
        if (!propertyBatch || !sceneBatch) {
          throw new Error('Expected property and Scene batches')
        }
        return {
          ...source,
          mode: 'progressive' as const,
          slices: [
            {
              sliceId: 'property-slice',
              orderedIds: ['rect-a'],
              batches: [propertyBatch]
            },
            {
              sliceId: 'scene-slice',
              orderedIds: ['rect-a'],
              batches: [sceneBatch]
            }
          ]
        }
      }
    ],
    [
      'malformed hierarchy evidence',
      false,
      () =>
        publication(
          [
            delivery(
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
                    elementId: 'rect-b',
                    before: { parentId: 'workspace-a', index: 0 },
                    after: { parentId: 'group-a', index: 1 }
                  }
                ]
              },
              'malformed-move'
            )
          ],
          'malformed-hierarchy'
        )
    ]
  ])(
    'rejects %s before transaction or Core apply',
    (_name, policyRuns, make) => {
      const harness = createHarness()

      expect(() => harness.processPublication(make())).toThrow()
      if (policyRuns) {
        expect(harness.decideRemotePublication).toHaveBeenCalledOnce()
      } else {
        expect(harness.decideRemotePublication).not.toHaveBeenCalled()
      }
      expect(harness.runRemoteTransaction).not.toHaveBeenCalled()
      expect(harness.applyCanonicalChanges).not.toHaveBeenCalled()
    }
  )
})

interface MaterializedTestDocument {
  readonly appliedValues: readonly number[]
}

type MaterializationTestRecord =
  MaterializedDocumentRecord<MaterializedTestDocument>

const createMaterializationHarness = (
  applyCanonicalChanges: (
    document: MaterializedTestDocument,
    changes: readonly CanonicalChange[]
  ) => MaterializedTestDocument = (document, changes) => ({
    appliedValues: [
      ...document.appliedValues,
      ...changes.flatMap((change) =>
        change.kind === 'property-components'
          ? change.updates.flatMap(({ values }) =>
              typeof values.x === 'number' ? [values.x] : []
            )
          : []
      )
    ]
  })
) => {
  let record: MaterializationTestRecord = {
    document: { appliedValues: [] },
    durableSequence: 0,
    publicationSequences: {},
    batches: {}
  }
  const store: DocumentMaterializationStore<MaterializedTestDocument> = {
    async transact<Result>(
      _documentId: string,
      execute: (
        current: MaterializationTestRecord,
        commit: (next: MaterializationTestRecord) => void
      ) => Promise<Result>
    ): Promise<Result> {
      let next: MaterializationTestRecord | undefined
      const result = await execute(record, (candidate) => {
        next = candidate
      })
      if (next) record = next
      return result
    }
  }
  const transact = vi.spyOn(store, 'transact')
  const apply = vi.fn(applyCanonicalChanges)
  const authorize = vi.fn(async () => undefined)
  const service = createDocumentMaterializationService({
    applyCanonicalChanges: apply,
    authorize,
    store
  })

  return {
    apply,
    authorize,
    getRecord: () => record,
    service,
    transact
  }
}

const persistenceBatch = (
  entries: readonly Readonly<{
    sequence: number
    publication: SharedPublication
  }>[],
  options: Readonly<{
    batchId?: string
    documentId?: string
    expectedDurableSequence?: number
  }> = {}
) => ({
  protocolVersion: 1,
  batchId: options.batchId ?? 'persistence-batch-a',
  documentId: options.documentId ?? 'document-a',
  expectedDurableSequence: options.expectedDurableSequence ?? 0,
  firstSequence: entries[0]?.sequence ?? 0,
  lastSequence: entries.at(-1)?.sequence ?? 0,
  entries: entries.map(({ sequence, publication: item }) => ({
    documentId: options.documentId ?? 'document-a',
    sequence,
    publication: item
  }))
})

describe('Asyra Design backend document materialization', () => {
  it('decodes and applies every publication in sequence before acknowledging the contiguous durable sequence', async () => {
    const harness = createMaterializationHarness()
    const batch = persistenceBatch([
      {
        sequence: 1,
        publication: publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'publication-1'
        )
      },
      {
        sequence: 2,
        publication: publication(
          propertyUpdateDeliveries('position-a', { x: 20 }),
          'publication-2'
        )
      }
    ])

    await expect(harness.service.materialize(batch)).resolves.toEqual({
      durableSequence: 2
    })
    expect(harness.apply).toHaveBeenCalledTimes(2)
    expect(harness.getRecord()).toMatchObject({
      document: { appliedValues: [10, 20] },
      durableSequence: 2,
      publicationSequences: {
        'publication-1': 1,
        'publication-2': 2
      }
    })
  })

  it('returns the existing watermark for exact batch and publication retries without applying twice', async () => {
    const harness = createMaterializationHarness()
    const entries = [
      {
        sequence: 1,
        publication: publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'publication-1'
        )
      }
    ]
    const batch = persistenceBatch(entries)

    await harness.service.materialize(batch)
    await expect(harness.service.materialize(batch)).resolves.toEqual({
      durableSequence: 1
    })
    await expect(
      harness.service.materialize(
        persistenceBatch(entries, { batchId: 'publication-retry-batch' })
      )
    ).resolves.toEqual({ durableSequence: 1 })
    expect(harness.apply).toHaveBeenCalledOnce()
  })

  it('treats publication identities as own data keys instead of object prototype members', async () => {
    const harness = createMaterializationHarness()

    await expect(
      harness.service.materialize(
        persistenceBatch([
          {
            sequence: 1,
            publication: publication(
              propertyUpdateDeliveries('position-a', { x: 10 }),
              '__proto__'
            )
          }
        ])
      )
    ).resolves.toEqual({ durableSequence: 1 })
    expect(
      Object.hasOwn(harness.getRecord().publicationSequences, '__proto__')
    ).toBe(true)
    expect(harness.getRecord().publicationSequences.__proto__).toBe(1)
  })

  it('rejects a batch whose expected durable sequence conflicts with the stored checkpoint', async () => {
    const harness = createMaterializationHarness()
    await harness.service.materialize(
      persistenceBatch([
        {
          sequence: 1,
          publication: publication(
            propertyUpdateDeliveries('position-a', { x: 10 }),
            'publication-1'
          )
        }
      ])
    )

    await expect(
      harness.service.materialize(
        persistenceBatch(
          [
            {
              sequence: 1,
              publication: publication(
                propertyUpdateDeliveries('position-a', { x: 20 }),
                'publication-conflict'
              )
            }
          ],
          { batchId: 'conflicting-checkpoint-batch' }
        )
      )
    ).rejects.toThrow('expected durable sequence conflicts')
    expect(harness.getRecord().document.appliedValues).toEqual([10])
    expect(harness.getRecord().durableSequence).toBe(1)
  })

  it('rejects sequence gaps and unsupported channels before opening a storage transaction', async () => {
    const harness = createMaterializationHarness()
    const gapped = persistenceBatch([
      {
        sequence: 1,
        publication: publication(
          propertyUpdateDeliveries('position-a', { x: 10 }),
          'publication-1'
        )
      },
      {
        sequence: 3,
        publication: publication(
          propertyUpdateDeliveries('position-a', { x: 30 }),
          'publication-3'
        )
      }
    ])

    await expect(harness.service.materialize(gapped)).rejects.toThrow(
      'contiguous'
    )
    await expect(
      harness.service.materialize(
        persistenceBatch([
          {
            sequence: 1,
            publication: publication(
              [delivery('selection', 'selection.update', {})],
              'selection-publication'
            )
          }
        ])
      )
    ).rejects.toThrow('unsupported collaboration delivery')
    expect(harness.transact).not.toHaveBeenCalled()
    expect(harness.apply).not.toHaveBeenCalled()
  })

  it('does not commit any publication or advance durability when a later publication fails', async () => {
    const harness = createMaterializationHarness((document, changes) => {
      const nextValue = changes.flatMap((change) =>
        change.kind === 'property-components'
          ? change.updates.flatMap(({ values }) =>
              typeof values.x === 'number' ? [values.x] : []
            )
          : []
      )[0]
      if (nextValue === 20) throw new Error('backend canonical apply failed')
      return {
        appliedValues:
          nextValue === undefined
            ? document.appliedValues
            : [...document.appliedValues, nextValue]
      }
    })

    await expect(
      harness.service.materialize(
        persistenceBatch([
          {
            sequence: 1,
            publication: publication(
              propertyUpdateDeliveries('position-a', { x: 10 }),
              'publication-1'
            )
          },
          {
            sequence: 2,
            publication: publication(
              propertyUpdateDeliveries('position-a', { x: 20 }),
              'publication-2'
            )
          }
        ])
      )
    ).rejects.toThrow('backend canonical apply failed')
    expect(harness.getRecord()).toEqual({
      document: { appliedValues: [] },
      durableSequence: 0,
      publicationSequences: {},
      batches: {}
    })
  })
})
