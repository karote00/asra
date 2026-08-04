import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Factory,
  LocalSharedDataChannel,
  type SharedPublication
} from '@asyra/factory'
import propsManager, {
  createPropertyComponentFromConfig,
  elementPropertyRegistry,
  propertyComponentRegistry,
  registerPropertyComponent
} from '@asyra/props-manager'
import sceneTree, {
  componentRegistry,
  createDynamicComponent
} from '@asyra/scene-tree'
import {
  EventTypes,
  runTransaction,
  runWithTransactionOwner,
  subscribeToEventBatches
} from '@asyra/reactive-events'
import {
  EntityTypes,
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type CreateElementData,
  type ElementRawData,
  type ElementInstanceTypes,
  type GroupInstanceTypes,
  type PropertyComponentRawData,
  type TransactionStatusPayload
} from '@asyra/utils'
import { Core } from '../core.js'

const LEAF_TYPE = 'gate3-factory-leaf'
const CONTAINER_TYPE = 'gate3-factory-container'
const CANONICAL_LEAF_TYPE = 'gate3-canonical-leaf'
const CANONICAL_PROPERTY_TYPE = 'gate3-canonical-value'

const registerComponents = () => {
  componentRegistry.getAll().forEach((_, type) => {
    componentRegistry.unregister(type)
  })
  componentRegistry.register({
    type: LEAF_TYPE,
    idPrefix: 'gate3-leaf',
    namePrefix: 'Gate 3 Leaf',
    constructor: createDynamicComponent(
      LEAF_TYPE,
      'gate3-leaf',
      'Gate 3 Leaf',
      [],
      {}
    ),
    properties: [],
    defaults: {}
  })
  componentRegistry.register({
    type: CONTAINER_TYPE,
    idPrefix: 'gate3-container',
    namePrefix: 'Gate 3 Container',
    constructor: createDynamicComponent(
      CONTAINER_TYPE,
      'gate3-container',
      'Gate 3 Container',
      [],
      {},
      true
    ),
    properties: [],
    defaults: {},
    isContainer: true
  })
  componentRegistry.register({
    type: CANONICAL_LEAF_TYPE,
    idPrefix: 'gate3-canonical-leaf',
    namePrefix: 'Gate 3 Canonical Leaf',
    constructor: createDynamicComponent(
      CANONICAL_LEAF_TYPE,
      'gate3-canonical-leaf',
      'Gate 3 Canonical Leaf',
      [{ name: 'value', type: CANONICAL_PROPERTY_TYPE }],
      {}
    ),
    properties: [{ name: 'value', type: CANONICAL_PROPERTY_TYPE }],
    defaults: {}
  })
  elementPropertyRegistry.register(
    { name: 'value', type: CANONICAL_PROPERTY_TYPE },
    CANONICAL_LEAF_TYPE
  )
}

const registerProperties = () => {
  propertyComponentRegistry.clear()
  const config = {
    type: CANONICAL_PROPERTY_TYPE,
    defaults: { value: 0 },
    persistKeys: ['value'],
    valueKeys: ['value']
  }
  registerPropertyComponent(
    CANONICAL_PROPERTY_TYPE,
    createPropertyComponentFromConfig(config),
    undefined,
    config
  )
}

const add = (
  id: string,
  type: string,
  parent: GroupInstanceTypes
): ElementInstanceTypes => {
  const addedId = sceneTree.addNewElement(
    { id, type } as CreateElementData,
    parent
  )
  return sceneTree.getElementById(addedId) as ElementInstanceTypes
}

const childrenOf = (parentId: string): string[] => [
  ...(sceneTree.getElementById(parentId) as GroupInstanceTypes).get('children')
]

const createCoreFacade = (factory: Factory): Core =>
  new Core({
    inputSystem: {} as never,
    factory,
    props: propsManager,
    render: {
      getViewportPosition: () => ({ x: 0, y: 0 }),
      getViewportScale: () => 1
    } as never,
    sceneTree,
    selection: {} as never,
    systemContext: {} as never
  })

const publicationDeliveriesWithChannel = (publication: SharedPublication) =>
  publication.slices.flatMap(({ batches }) =>
    batches.flatMap(({ channel, deliveries }) =>
      deliveries.map((delivery) => ({ channel, ...delivery }))
    )
  )

describe('Factory and Scene Tree hierarchy transaction integration', () => {
  beforeEach(() => {
    sceneTree.reset()
    propsManager.reset()
    registerProperties()
    registerComponents()
    sceneTree.init()
    sceneTree.cleanChanges()
  })

  it('undoes and redoes exact move plus subtree evidence as one grouped transaction', () => {
    const factory = new Factory()
    const channel = new LocalSharedDataChannel()
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    expect(root.get('type')).toBe(EntityTypes.WORKSPACE)
    add('target', CONTAINER_TYPE, root)
    const moved = add('moved', LEAF_TYPE, root)
    const subtree = add('subtree', CONTAINER_TYPE, root) as GroupInstanceTypes
    const firstChild = add('first-child', CANONICAL_LEAF_TYPE, subtree)
    const nested = add('nested', CONTAINER_TYPE, subtree) as GroupInstanceTypes
    const grandchild = add('grandchild', LEAF_TYPE, nested)
    const originalRootOrder = childrenOf(sceneTree.workspace)
    const originalSubtreeOrder = childrenOf('subtree')
    const originalProps = propsManager.save()
    expect(Object.keys(originalProps).length).toBeGreaterThan(0)

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        sceneTree.moveElements({
          elementIds: ['moved'],
          targetParentId: 'target',
          targetIndex: 0
        })
        sceneTree.removeSubtree('subtree')
      })
    })

    expect(childrenOf(sceneTree.workspace)).toEqual(['target'])
    expect(childrenOf('target')).toEqual(['moved'])
    expect(propsManager.save()).toEqual(originalProps)
    expect(publications).toHaveLength(1)
    expect(publicationDeliveriesWithChannel(publications[0])).toHaveLength(2)

    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual(originalRootOrder)
    expect(childrenOf('target')).toEqual([])
    expect(childrenOf('subtree')).toEqual(originalSubtreeOrder)
    expect(childrenOf('nested')).toEqual(['grandchild'])
    expect(sceneTree.getElementById('moved')).toBe(moved)
    expect(sceneTree.getElementById('subtree')).toBe(subtree)
    expect(sceneTree.getElementById('first-child')).toBe(firstChild)
    expect(sceneTree.getElementById('nested')).toBe(nested)
    expect(sceneTree.getElementById('grandchild')).toBe(grandchild)
    expect(propsManager.save()).toEqual(originalProps)
    expect(publications).toHaveLength(2)
    expect(publications[1]?.origin).toBe('undo')

    factory.redo()

    expect(childrenOf(sceneTree.workspace)).toEqual(['target'])
    expect(childrenOf('target')).toEqual(['moved'])
    expect(sceneTree.getElementById('subtree')).toBeUndefined()
    expect(sceneTree.getElementById('first-child')).toBeUndefined()
    expect(sceneTree.getElementById('nested')).toBeUndefined()
    expect(sceneTree.getElementById('grandchild')).toBeUndefined()
    expect(propsManager.save()).toEqual(originalProps)
    expect(publications).toHaveLength(3)
    expect(publications[2]?.origin).toBe('redo')

    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual(originalRootOrder)
    expect(childrenOf('target')).toEqual([])
    expect(childrenOf('subtree')).toEqual(originalSubtreeOrder)
    expect(childrenOf('nested')).toEqual(['grandchild'])
    expect(sceneTree.getElementById('subtree')).toBe(subtree)
    expect(sceneTree.getElementById('first-child')).toBe(firstChild)
    expect(sceneTree.getElementById('nested')).toBe(nested)
    expect(sceneTree.getElementById('grandchild')).toBe(grandchild)
    expect(propsManager.save()).toEqual(originalProps)
    expect(publications).toHaveLength(4)
    expect(publications[3]?.origin).toBe('undo')

    factory.transact.reset()
  })

  it('undoes and redoes one canonical element batch as one history action', () => {
    const factory = new Factory()
    const channel = new LocalSharedDataChannel()
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const batch = [
      { id: 'batch-history-1', type: LEAF_TYPE },
      { id: 'batch-history-2', type: LEAF_TYPE },
      { id: 'batch-history-3', type: LEAF_TYPE }
    ] as CreateElementData[]

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        expect(sceneTree.addNewElements(batch, root)).toEqual([
          'batch-history-1',
          'batch-history-2',
          'batch-history-3'
        ])
      })
    })

    expect(childrenOf(sceneTree.workspace)).toEqual([
      'batch-history-1',
      'batch-history-2',
      'batch-history-3'
    ])
    expect(publications).toHaveLength(1)
    expect(publicationDeliveriesWithChannel(publications[0])).toHaveLength(3)

    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById('batch-history-1')).toBeUndefined()
    expect(sceneTree.getElementById('batch-history-2')).toBeUndefined()
    expect(sceneTree.getElementById('batch-history-3')).toBeUndefined()
    expect(publications).toHaveLength(2)
    expect(publications[1]?.origin).toBe('undo')

    factory.redo()

    expect(childrenOf(sceneTree.workspace)).toEqual([
      'batch-history-1',
      'batch-history-2',
      'batch-history-3'
    ])
    expect(publications).toHaveLength(3)
    expect(publications[2]?.origin).toBe('redo')

    factory.transact.reset()
  })

  it('replays one real plural Scene removal through the same tombstone on Undo and Redo', () => {
    const factory = new Factory()
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const retained = add('tombstone-retained', LEAF_TYPE, root)
    const removed = add('tombstone-replayed', LEAF_TYPE, root)
    sceneTree.cleanChanges()
    const prepared = sceneTree.prepareElementRemoval(['tombstone-replayed'])

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        sceneTree.applyPreparedElementMutation(prepared, {
          shared: SharedDataChannelNames.SCENE_TREE
        })
      })
    })

    expect(childrenOf(sceneTree.workspace)).toEqual(['tombstone-retained'])
    expect(sceneTree.getElementById('tombstone-replayed')).toBeUndefined()
    expect(sceneTree._deletedMap.get('tombstone-replayed')).toBe(removed)
    expect(publications).toHaveLength(1)
    expect(publicationDeliveriesWithChannel(publications[0])).toHaveLength(1)

    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual([
      'tombstone-retained',
      'tombstone-replayed'
    ])
    expect(sceneTree.getElementById('tombstone-retained')).toBe(retained)
    expect(sceneTree.getElementById('tombstone-replayed')).toBe(removed)
    expect(sceneTree._deletedMap.has('tombstone-replayed')).toBe(false)
    expect(publications).toHaveLength(2)
    expect(publications[1]?.origin).toBe('undo')

    factory.redo()

    expect(childrenOf(sceneTree.workspace)).toEqual(['tombstone-retained'])
    expect(sceneTree.getElementById('tombstone-replayed')).toBeUndefined()
    expect(sceneTree._deletedMap.get('tombstone-replayed')).toBe(removed)
    expect(publications).toHaveLength(3)
    expect(publications[2]?.origin).toBe('redo')

    factory.transact.reset()
  })

  it('coordinates complete element-property targets before one Props apply', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    const core = createCoreFacade(factory)
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const first = add('property-target-first', CANONICAL_LEAF_TYPE, root)
    const second = add('property-target-second', CANONICAL_LEAF_TYPE, root)
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const sequence: string[] = []
    const resolveTargets =
      sceneTree.resolveElementPropertyTargets.bind(sceneTree)
    const prepareProperties =
      propsManager.preparePropertyMutationBatch.bind(propsManager)
    const applyProperties =
      propsManager.applyPreparedPropertyMutationBatch.bind(propsManager)
    const resolveSpy = vi
      .spyOn(sceneTree, 'resolveElementPropertyTargets')
      .mockImplementation((requests) => {
        sequence.push('target')
        return resolveTargets(requests)
      })
    const prepareSpy = vi
      .spyOn(propsManager, 'preparePropertyMutationBatch')
      .mockImplementation((mutations) => {
        sequence.push('props-preflight')
        return prepareProperties(mutations)
      })
    const applySpy = vi
      .spyOn(propsManager, 'applyPreparedPropertyMutationBatch')
      .mockImplementation((prepared) => {
        sequence.push('props-apply')
        return applyProperties(prepared)
      })
    let result: readonly string[] = []

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        result = core.updateElementProperties([
          {
            elementId: first.get('id'),
            values: { value: 19 }
          },
          {
            elementId: second.get('id'),
            values: { value: 23 }
          }
        ])
      })
    })

    expect(sequence).toEqual(['target', 'props-preflight', 'props-apply'])
    expect(result).toEqual(['property-target-first', 'property-target-second'])
    expect(
      propsManager
        .getPropertyById(first.props.getPropId('value') as string)
        ?.save()
    ).toMatchObject({ value: 19 })
    expect(
      propsManager
        .getPropertyById(second.props.getPropId('value') as string)
        ?.save()
    ).toMatchObject({ value: 23 })
    expect(resolveSpy).toHaveBeenCalledOnce()
    expect(prepareSpy).toHaveBeenCalledOnce()
    expect(applySpy).toHaveBeenCalledOnce()

    resolveSpy.mockRestore()
    prepareSpy.mockRestore()
    applySpy.mockRestore()
    factory.transact.reset()
  })

  it('reprojects canonical property action, Undo, and Redo through ordinary computed batches', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    const core = createCoreFacade(factory)
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const element = add(
      'property-projection-history',
      CANONICAL_LEAF_TYPE,
      root
    )
    const getComputedValue = (): unknown =>
      (element.getAllComputedData() as Record<string, unknown>).value
    const computedBatches: unknown[][] = []
    const computedTransactionEvents: unknown[] = []
    const subscription = subscribeToEventBatches((events) => {
      const computedEvents = events.filter(
        ({ type }) =>
          type === EventTypes.UPDATE_COMPUTED_DATA ||
          type === EventTypes.UPDATE_COMPUTED_DATA_PATCH
      )
      if (computedEvents.length > 0) {
        computedBatches.push(computedEvents)
      }
      computedTransactionEvents.push(
        ...events.filter(
          (event) =>
            event.type === EventTypes.UPDATE_TRANSACTION &&
            'eventName' in event &&
            (event.eventName === EventTypes.UPDATE_COMPUTED_DATA ||
              event.eventName === EventTypes.UPDATE_COMPUTED_DATA_PATCH)
        )
      )
    })

    try {
      factory.transact.reset()
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          core.updateElementProperties([
            {
              elementId: element.get('id'),
              values: { value: 19 }
            }
          ])
        })
      })

      expect(getComputedValue()).toBe(19)
      expect(computedBatches).toHaveLength(1)

      computedBatches.length = 0
      factory.undo()

      expect(getComputedValue()).toBe(0)
      expect(computedBatches).toHaveLength(1)

      computedBatches.length = 0
      factory.redo()

      expect(getComputedValue()).toBe(19)
      expect(computedBatches).toHaveLength(1)
      expect(computedTransactionEvents).toEqual([])
    } finally {
      subscription.unsubscribe()
      factory.transact.reset()
    }
  })

  it('leaves no cross-owner prefix when a later element-property target is invalid', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    const core = createCoreFacade(factory)
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    add('property-valid-prefix', CANONICAL_LEAF_TYPE, root)
    sceneTree.cleanChanges()
    propsManager.cleanChanges()
    const beforeProps = propsManager.save()
    const applySpy = vi.spyOn(
      propsManager,
      'applyPreparedPropertyMutationBatch'
    )

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          core.updateElementProperties([
            {
              elementId: 'property-valid-prefix',
              values: { value: 19 }
            },
            {
              elementId: 'property-missing-tail',
              values: { value: 23 }
            }
          ])
        })
      })
    ).toThrow(/property-missing-tail/i)

    expect(applySpy).not.toHaveBeenCalled()
    expect(propsManager.save()).toEqual(beforeProps)
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
    expect(factory.getUndoHistoryDepth()).toBe(0)

    applySpy.mockRestore()
    factory.transact.reset()
  })

  it('keeps public-facade Group and children on one outer transaction handle and history action', () => {
    const factory = new Factory()
    const statuses: TransactionStatusPayload[] = []
    factory.subscribeToTransactionStatus((status) => statuses.push(status))
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const core = createCoreFacade(factory)
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const childIds = Array.from(
      { length: 16 },
      (_, index) => `facade-child-${index + 1}`
    )
    let result: readonly string[] = []

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        const groupId = core.createElementInParent(
          { id: 'facade-group', type: CONTAINER_TYPE, x: 0, y: 0 },
          root.get('id')
        )
        result = core.createElementsInParent(
          childIds.map((id, index) => ({
            id,
            type: CANONICAL_LEAF_TYPE,
            value: index + 1,
            x: 0,
            y: 0
          })),
          groupId
        )

        expect(result).toEqual(childIds)
        expect(Object.isFrozen(result)).toBe(true)
        expect(publications).toEqual([])
      })
    })

    expect(publications).toHaveLength(1)
    expect(
      publications[0]?.slices.flatMap(({ batches }) =>
        batches.flatMap((batch) =>
          batch.deliveries.map((delivery) => ({
            channel: batch.channel,
            orderedIds: delivery.orderedIds
          }))
        )
      )
    ).toEqual([
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        orderedIds: ['facade-group']
      },
      ...childIds.map((id) => ({
        channel: SharedDataChannelNames.PROPS,
        orderedIds: [id]
      })),
      ...childIds.map((id) => ({
        channel: SharedDataChannelNames.SCENE_TREE,
        orderedIds: [id]
      }))
    ])
    expect(childrenOf(sceneTree.workspace)).toEqual(['facade-group'])
    expect(childrenOf('facade-group')).toEqual(childIds)
    const committedProps = propsManager.save()
    expect(Object.keys(committedProps).length).toBeGreaterThan(0)
    expect(statuses.at(-1)).toMatchObject({
      origin: 'action',
      status: 'committed'
    })

    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById('facade-group')).toBeUndefined()
    childIds.forEach((id) =>
      expect(sceneTree.getElementById(id)).toBeUndefined()
    )
    expect(propsManager.save()).toEqual({})
    expect(statuses.at(-1)).toMatchObject({
      origin: 'undo',
      status: 'committed'
    })

    factory.redo()

    expect(childrenOf(sceneTree.workspace)).toEqual(['facade-group'])
    expect(childrenOf('facade-group')).toEqual(childIds)
    expect(propsManager.save()).toEqual(committedProps)
    expect(statuses.at(-1)).toMatchObject({
      origin: 'redo',
      status: 'committed'
    })

    factory.transact.reset()
  })

  it('lets one outer Factory rollback restore an accepted canonical batch after immediate delivery failure', () => {
    const factory = new Factory()
    const deliveryFailure = new Error('canonical immediate delivery failed')
    const propsChannel = new LocalSharedDataChannel()
    propsChannel.appendBatch = vi.fn(() => {
      throw deliveryFailure
    })
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      propsChannel
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const statuses: TransactionStatusPayload[] = []
    factory.subscribeToTransactionStatus((status) => statuses.push(status))
    const core = createCoreFacade(factory)
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    let observedFailure: unknown

    try {
      runWithTransactionOwner(factory.getTransactionOwner(), () =>
        runTransaction(() =>
          core.createElementsInParent(
            [
              {
                id: 'accepted-immediate-failure',
                type: CANONICAL_LEAF_TYPE,
                x: 0,
                y: 0,
                value: 17
              }
            ],
            root.get('id'),
            undefined,
            { sharedDelivery: 'immediate' }
          )
        )
      )
    } catch (error) {
      observedFailure = error
    }

    expect(observedFailure).toMatchObject({
      batchAccepted: true,
      message: deliveryFailure.message
    })
    expect(propsChannel.appendBatch).toHaveBeenCalledOnce()
    expect(
      sceneTree.getElementById('accepted-immediate-failure')
    ).toBeUndefined()
    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(propsManager.save()).toEqual({})
    expect(propsManager.changes).toEqual([])
    expect(sceneTree.changes).toEqual([])
    expect(factory.getUndoHistoryDepth()).toBe(0)
    expect(statuses.at(-1)).toMatchObject({ status: 'rolled-back' })
    expect(statuses.some(({ status }) => status === 'rollback-failed')).toBe(
      false
    )

    factory.transact.reset()
  })

  it('leaves no public-facade prefix when a later batch item is invalid', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const core = createCoreFacade(factory)
    const root = sceneTree.currentWorkspace as GroupInstanceTypes

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          core.createElementsInParent(
            [
              {
                id: 'valid-prefix-candidate',
                type: LEAF_TYPE,
                x: 0,
                y: 0
              },
              {
                id: 'invalid-later-item',
                type: 'missing-step4-component-type',
                x: 0,
                y: 0
              }
            ],
            root.get('id')
          )
        })
      })
    ).toThrow()

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById('valid-prefix-candidate')).toBeUndefined()
    expect(sceneTree.getElementById('invalid-later-item')).toBeUndefined()
    expect(factory.getUndoHistoryDepth()).toBe(0)

    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(factory.getUndoHistoryDepth()).toBe(0)
    factory.transact.reset()
  })

  it('records exact canonical properties and elements as one ordered history action', () => {
    const factory = new Factory()
    const core = createCoreFacade(factory)
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const properties = [
      {
        id: 'canonical-shared-value',
        type: CANONICAL_PROPERTY_TYPE,
        value: 11
      }
    ] as readonly PropertyComponentRawData[]
    const elements = [
      {
        id: 'canonical-history-1',
        type: CANONICAL_LEAF_TYPE,
        name: 'Canonical History 1',
        parentId: root.get('id'),
        visible: true,
        lock: false,
        props: { value: 'canonical-shared-value' }
      },
      {
        id: 'canonical-history-2',
        type: CANONICAL_LEAF_TYPE,
        name: 'Canonical History 2',
        parentId: root.get('id'),
        visible: true,
        lock: false,
        props: { value: 'canonical-shared-value' }
      }
    ] as unknown as readonly ElementRawData[]

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        expect(
          core.createElementsInParentFromCanonicalData(
            elements,
            properties,
            root.get('id')
          )
        ).toEqual(['canonical-history-1', 'canonical-history-2'])
      })
    })

    expect(publications).toHaveLength(1)
    const deliveries = publicationDeliveriesWithChannel(publications[0])
    expect(
      deliveries.map(({ channel, eventName, payload }) => ({
        channel,
        eventName,
        action: (payload as { action?: string }).action
      }))
    ).toEqual([
      {
        channel: SharedDataChannelNames.PROPS,
        eventName: EventTypes.ADD_PROPERTY,
        action: PROPS_ACTIONS.ADD_PROPERTY
      },
      ...elements.map(() => ({
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.ADD_ELEMENTS,
        action: SCENE_TREE_ACTIONS.ADD_ELEMENTS
      }))
    ])
    expect(
      (
        deliveries[0]?.payload as {
          data: readonly PropertyComponentRawData[]
        }
      ).data
    ).toEqual(properties)
    expect(
      deliveries.slice(1).map(({ payload }) =>
        (
          payload as {
            entries: readonly {
              data: ElementRawData
            }[]
          }
        ).entries.map(({ data: { id } }) => id)
      )
    ).toEqual(elements.map(({ id }) => [id]))
    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(propsManager.save()).toEqual({})
    expect(sceneTree.getElementById('canonical-history-1')).toBeUndefined()
    expect(sceneTree.getElementById('canonical-history-2')).toBeUndefined()

    factory.redo()

    expect(childrenOf(sceneTree.workspace)).toEqual([
      'canonical-history-1',
      'canonical-history-2'
    ])
    expect(propsManager.save()).toEqual(
      Object.fromEntries(properties.map((property) => [property.id, property]))
    )
    expect(
      elements.map(({ id }) => sceneTree.getElementById(id)?.save())
    ).toEqual(elements)
    expect(publications.map(({ origin }) => origin)).toEqual([
      'action',
      'undo',
      'redo'
    ])

    factory.transact.reset()
  })

  it('hands one immediate local creation to Factory as one Props-then-Scene publication slice', async () => {
    const factory = new Factory()
    const core = createCoreFacade(factory)
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const updateTransactionBatch = vi.spyOn(factory, 'updateTransactionBatch')
    const root = sceneTree.currentWorkspace as GroupInstanceTypes

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        expect(
          core.createElementsInParent(
            [
              {
                id: 'immediate-canonical-source',
                name: 'Immediate Canonical Source',
                type: CANONICAL_LEAF_TYPE,
                value: 17,
                x: 0,
                y: 0
              }
            ],
            root.get('id'),
            undefined,
            {
              sharedDelivery: 'immediate',
              undoable: true
            }
          )
        ).toEqual(['immediate-canonical-source'])
      })
    })
    await Promise.resolve()

    expect(updateTransactionBatch).toHaveBeenCalledOnce()
    expect(publications).toHaveLength(1)
    expect(publications[0]?.slices).toHaveLength(1)
    expect(
      publications[0]?.slices[0]?.batches.map(({ channel }) => channel)
    ).toEqual([SharedDataChannelNames.PROPS, SharedDataChannelNames.SCENE_TREE])

    updateTransactionBatch.mockRestore()
    factory.transact.reset()
  })

  it('rolls back canonical properties when scene evidence cannot commit', () => {
    const factory = new Factory()
    const core = createCoreFacade(factory)
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const applyPreparedElementMutation =
      sceneTree.applyPreparedElementMutation.bind(sceneTree)
    const applySpy = vi
      .spyOn(sceneTree, 'applyPreparedElementMutation')
      .mockImplementationOnce((prepared, options) => {
        applyPreparedElementMutation(prepared, options)
        throw new Error('scene evidence commit failed')
      })

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          core.createElementsInParentFromCanonicalData(
            [
              {
                id: 'canonical-failed-element',
                type: CANONICAL_LEAF_TYPE,
                name: 'Canonical Failed Element',
                parentId: root.get('id'),
                visible: true,
                lock: false,
                props: { value: 'canonical-failed-value' }
              }
            ] as unknown as readonly ElementRawData[],
            [
              {
                id: 'canonical-failed-value',
                type: CANONICAL_PROPERTY_TYPE,
                value: 33
              }
            ] as readonly PropertyComponentRawData[],
            root.get('id')
          )
        })
      })
    ).toThrow('scene evidence commit failed')
    applySpy.mockRestore()

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById('canonical-failed-element')).toBeUndefined()
    expect(propsManager.save()).toEqual({})
    expect(publications).toEqual([])
    factory.undo()
    expect(publications).toEqual([])

    factory.transact.reset()
  })

  it('reuses one active shared property across elements and preserves its original owner through undo', () => {
    const factory = new Factory()
    const core = createCoreFacade(factory)
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const property = {
      id: 'existing-owner-value',
      type: CANONICAL_PROPERTY_TYPE,
      value: 44
    } as PropertyComponentRawData
    const existingElement = {
      id: 'existing-owner-element',
      type: CANONICAL_LEAF_TYPE,
      name: 'Existing Owner Element',
      parentId: root.get('id'),
      visible: true,
      lock: false,
      props: { value: 'existing-owner-value' }
    } as unknown as ElementRawData
    const sharedElement = {
      ...existingElement,
      id: 'shared-owner-element',
      name: 'Shared Owner Element'
    } as ElementRawData

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        core.createElementsInParentFromCanonicalData(
          [existingElement],
          [property],
          root.get('id')
        )
      })
    })
    const activeProperty = propsManager.getPropertyById('existing-owner-value')
    publications.length = 0

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        expect(
          core.createElementsInParentFromCanonicalData(
            [sharedElement],
            [],
            root.get('id')
          )
        ).toEqual(['shared-owner-element'])
      })
    })

    expect(propsManager.getPropertyById('existing-owner-value')).toBe(
      activeProperty
    )
    expect(sceneTree.getElementById('existing-owner-element')?.save()).toEqual(
      existingElement
    )
    expect(sceneTree.getElementById('shared-owner-element')?.save()).toEqual(
      sharedElement
    )
    expect(childrenOf(sceneTree.workspace)).toEqual([
      'existing-owner-element',
      'shared-owner-element'
    ])
    expect(propsManager.save()).toEqual({
      'existing-owner-value': property
    })
    expect(
      sceneTree
        .getElementPropertyRelations('existing-owner-value')
        .map(({ ownerElementId }) => ownerElementId)
    ).toEqual(['existing-owner-element', 'shared-owner-element'])
    expect(publications).toHaveLength(1)

    factory.undo()
    expect(childrenOf(sceneTree.workspace)).toEqual(['existing-owner-element'])
    expect(sceneTree.getElementById('shared-owner-element')).toBeUndefined()
    expect(propsManager.getPropertyById('existing-owner-value')).toBe(
      activeProperty
    )
    expect(
      sceneTree
        .getElementPropertyRelations('existing-owner-value')
        .map(({ ownerElementId }) => ownerElementId)
    ).toEqual(['existing-owner-element'])

    factory.redo()
    expect(childrenOf(sceneTree.workspace)).toEqual([
      'existing-owner-element',
      'shared-owner-element'
    ])
    expect(sceneTree.getElementById('shared-owner-element')?.save()).toEqual(
      sharedElement
    )
    expect(propsManager.getPropertyById('existing-owner-value')).toBe(
      activeProperty
    )
    expect(
      sceneTree
        .getElementPropertyRelations('existing-owner-value')
        .map(({ ownerElementId }) => ownerElementId)
    ).toEqual(['existing-owner-element', 'shared-owner-element'])
    expect(publications.map(({ origin }) => origin)).toEqual([
      'action',
      'undo',
      'redo'
    ])

    factory.transact.reset()
  })

  it('rolls back a completed canonical element batch with no published prefix', () => {
    const factory = new Factory()
    const channel = new LocalSharedDataChannel()
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const root = sceneTree.currentWorkspace as GroupInstanceTypes

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          sceneTree.addNewElements(
            [
              { id: 'rolled-back-batch-1', type: LEAF_TYPE },
              { id: 'rolled-back-batch-2', type: LEAF_TYPE }
            ] as CreateElementData[],
            root
          )
          throw new Error('cancel canonical element batch')
        })
      })
    ).toThrow('cancel canonical element batch')

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById('rolled-back-batch-1')).toBeUndefined()
    expect(sceneTree.getElementById('rolled-back-batch-2')).toBeUndefined()
    expect(publications).toEqual([])

    factory.undo()
    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(publications).toEqual([])

    factory.transact.reset()
  })

  it('rolls back hierarchy evidence without history, publication, or partial state', () => {
    const factory = new Factory()
    const channel = new LocalSharedDataChannel()
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    add('target', CONTAINER_TYPE, root)
    const moved = add('moved', LEAF_TYPE, root)
    const subtree = add('subtree', CONTAINER_TYPE, root) as GroupInstanceTypes
    const child = add('child', LEAF_TYPE, subtree)
    const before = childrenOf(sceneTree.workspace)

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          sceneTree.moveElements({
            elementIds: ['moved'],
            targetParentId: 'target',
            targetIndex: 0
          })
          sceneTree.removeSubtree('subtree')
          throw new Error('cancel hierarchy operation')
        })
      })
    ).toThrow('cancel hierarchy operation')

    expect(childrenOf(sceneTree.workspace)).toEqual(before)
    expect(childrenOf('target')).toEqual([])
    expect(childrenOf('subtree')).toEqual(['child'])
    expect(sceneTree.getElementById('moved')).toBe(moved)
    expect(sceneTree.getElementById('subtree')).toBe(subtree)
    expect(sceneTree.getElementById('child')).toBe(child)
    expect(publications).toEqual([])

    factory.undo()
    expect(childrenOf(sceneTree.workspace)).toEqual(before)
    expect(publications).toEqual([])

    factory.transact.reset()
  })

  it('does not create history or publication for a semantic hierarchy no-op', () => {
    const factory = new Factory()
    const channel = new LocalSharedDataChannel()
    const publications: SharedPublication[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const first = add('first', LEAF_TYPE, root)
    const second = add('second', LEAF_TYPE, root)

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        expect(
          sceneTree.moveElements({
            elementIds: ['first', 'second'],
            targetParentId: sceneTree.workspace,
            targetIndex: 0
          }).moves
        ).toEqual([])
      })
    })

    expect(publications).toEqual([])
    factory.undo()
    expect(childrenOf(sceneTree.workspace)).toEqual(['first', 'second'])
    expect(sceneTree.getElementById('first')).toBe(first)
    expect(sceneTree.getElementById('second')).toBe(second)
    expect(publications).toEqual([])

    factory.transact.reset()
  })
})
