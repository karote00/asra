import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Factory,
  LocalSharedDataChannel,
  type FactoryMutationBatchArtifact,
  type SharedPublication
} from '@asyra/factory'
import propsManager, {
  createPropertyComponentFromConfig,
  propertyComponentRegistry,
  registerPropertyComponent
} from '@asyra/props-manager'
import sceneTree, {
  componentRegistry,
  createDynamicComponent
} from '@asyra/scene-tree'
import {
  addProperty as publishAddProperty,
  EventTypes,
  getTransactionOwner,
  runTransaction,
  runWithTransactionOwner,
  type UpdateTransactionEvent
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
import { Core } from '../core'
import type { CanonicalElementBatchResult } from '../index'

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

type CanonicalElementBatchCoreContract = Core & {
  createElementsInParentBatch: (
    data: readonly CreateElementData[],
    parentId: string,
    index?: number,
    options?: {
      sharedDelivery?: 'transaction-end' | 'immediate'
    }
  ) => CanonicalElementBatchResult
}

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
    expect(propsManager.save()).toEqual({})
    expect(publications).toHaveLength(1)
    expect(publications[0]?.deliveries).toHaveLength(3)

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
    expect(propsManager.save()).toEqual({})
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
    expect(publications[0]?.deliveries).toHaveLength(3)

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
    const artifacts: FactoryMutationBatchArtifact[] = []
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    const core = createCoreFacade(factory)
    const batchCore = core as CanonicalElementBatchCoreContract
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const childIds = Array.from(
      { length: 16 },
      (_, index) => `facade-child-${index + 1}`
    )
    let result: CanonicalElementBatchResult | undefined

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        const groupId = core.createElementInParent(
          { id: 'facade-group', type: CONTAINER_TYPE, x: 0, y: 0 },
          root.get('id')
        )
        result = batchCore.createElementsInParentBatch(
          childIds.map((id, index) => ({
            id,
            type: CANONICAL_LEAF_TYPE,
            value: index + 1,
            x: 0,
            y: 0
          })),
          groupId
        )

        expect(result.orderedElementIds).toEqual(childIds)
        expect(result.deliveryHandle.artifact).toBeNull()
        expect(artifacts).toEqual([])
      })
    })

    const committedResult = result as CanonicalElementBatchResult
    expect(artifacts).toHaveLength(1)
    expect(committedResult.deliveryHandle.artifactId).toBe(
      artifacts[0]?.artifactId
    )
    expect(committedResult.deliveryHandle.transactionId).toBe(
      artifacts[0]?.transactionId
    )
    expect(committedResult.deliveryHandle.artifact).toBe(artifacts[0])
    expect(
      artifacts[0]?.changes.flatMap(
        (change) =>
          change.shared?.records.map((record) => ({
            channel: change.shared?.channel,
            orderedIds: record.orderedIds
          })) ?? []
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

  it('returns owner-issued detached monotonic timing for the complete canonical batch handoff', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const core = createCoreFacade(factory) as CanonicalElementBatchCoreContract
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const originalUpdateTransactionBatch =
      factory.updateTransactionBatch.bind(factory)
    let handoffCount = 0
    let handoffCompletedAtMs: number | undefined
    factory.updateTransactionBatch = (...args) => {
      handoffCount += 1
      const handle = originalUpdateTransactionBatch(...args)
      handoffCompletedAtMs = performance.now()
      return handle
    }
    let result: CanonicalElementBatchResult | undefined

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        result = core.createElementsInParentBatch(
          [
            { id: 'timed-child-1', type: LEAF_TYPE, x: 0, y: 0 },
            { id: 'timed-child-2', type: LEAF_TYPE, x: 0, y: 0 }
          ],
          root.get('id')
        )
      })
    })

    const timing = (result as CanonicalElementBatchResult).timing
    expect(timing).toEqual({
      owner: '@asyra/core',
      clock: 'monotonic',
      startedAtMs: expect.any(Number),
      completedAtMs: expect.any(Number),
      durationMs: expect.any(Number)
    })
    expect(timing.startedAtMs).toBeGreaterThanOrEqual(0)
    expect(timing.completedAtMs).toBeGreaterThanOrEqual(timing.startedAtMs)
    expect(timing.durationMs).toBe(timing.completedAtMs - timing.startedAtMs)
    expect(timing.durationMs).toBeGreaterThanOrEqual(0)
    expect(handoffCount).toBe(1)
    expect(handoffCompletedAtMs).toEqual(expect.any(Number))
    expect(timing.startedAtMs).toBeLessThanOrEqual(
      handoffCompletedAtMs as number
    )
    expect(timing.completedAtMs).toBeGreaterThanOrEqual(
      handoffCompletedAtMs as number
    )
    expect(Object.isFrozen(timing)).toBe(true)
    const timingSnapshot = { ...timing }

    factory.undo()

    expect(timing).toEqual(timingSnapshot)
    factory.transact.reset()
  })

  it('rejects a second canonical handoff before it reaches Factory and rolls back the outer transaction', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const core = createCoreFacade(factory) as CanonicalElementBatchCoreContract
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    const originalFactoryUpdateTransactionBatch =
      factory.updateTransactionBatch.bind(factory)
    let factoryHandoffCount = 0
    const factoryHandoffEventNames: string[][] = []
    factory.updateTransactionBatch = (...args) => {
      factoryHandoffCount += 1
      factoryHandoffEventNames.push(args[0].map(({ eventName }) => eventName))
      return originalFactoryUpdateTransactionBatch(...args)
    }
    const originalAddNewElements = sceneTree.addNewElements
    sceneTree.addNewElements = vi.fn(
      (...args: Parameters<typeof originalAddNewElements>) => {
        const orderedElementIds = originalAddNewElements.apply(sceneTree, args)
        const batchOwner = getTransactionOwner()
        if (
          !batchOwner ||
          !('updateTransactionBatch' in batchOwner) ||
          typeof batchOwner.updateTransactionBatch !== 'function'
        ) {
          throw new Error('Expected a batch-capable transaction owner')
        }
        batchOwner.updateTransactionBatch([
          {
            type: EventTypes.UPDATE_TRANSACTION,
            eventName: 'core-double-canonical-handoff-probe',
            payload: {
              action: 'core-double-canonical-handoff-probe'
            },
            options: {
              rollbackable: false,
              undoable: false
            }
          }
        ] satisfies readonly UpdateTransactionEvent[])
        return orderedElementIds
      }
    ) as typeof sceneTree.addNewElements
    let observedFailure: unknown

    try {
      runWithTransactionOwner(factory.getTransactionOwner(), () =>
        runTransaction(() =>
          core.createElementsInParentBatch(
            [
              {
                id: 'double-handoff-child',
                type: LEAF_TYPE,
                x: 0,
                y: 0
              }
            ],
            root.get('id')
          )
        )
      )
    } catch (error) {
      observedFailure = error
    } finally {
      sceneTree.addNewElements = originalAddNewElements
    }

    expect(factoryHandoffCount).toBe(2)
    expect(factoryHandoffEventNames.flat()).not.toContain(
      'core-double-canonical-handoff-probe'
    )
    expect(observedFailure).toMatchObject({
      message: expect.stringMatching(/exactly one Factory handoff/i)
    })
    expect(sceneTree.getElementById('double-handoff-child')).toBeUndefined()
    expect(childrenOf(sceneTree.workspace)).toEqual([])

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
    const artifacts: FactoryMutationBatchArtifact[] = []
    const statuses: TransactionStatusPayload[] = []
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    factory.subscribeToTransactionStatus((status) => statuses.push(status))
    const core = createCoreFacade(factory) as CanonicalElementBatchCoreContract
    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    let observedFailure: unknown

    try {
      runWithTransactionOwner(factory.getTransactionOwner(), () =>
        runTransaction(() =>
          core.createElementsInParentBatch(
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
    expect(artifacts).toEqual([])
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
    const artifacts: FactoryMutationBatchArtifact[] = []
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    const batchCore = createCoreFacade(
      factory
    ) as CanonicalElementBatchCoreContract
    const root = sceneTree.currentWorkspace as GroupInstanceTypes

    expect(typeof batchCore.createElementsInParentBatch).toBe('function')
    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          batchCore.createElementsInParentBatch(
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
    expect(artifacts).toEqual([])

    factory.undo()

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(artifacts).toEqual([])
    factory.transact.reset()
  })

  it('records exact canonical properties and elements as one ordered history action', () => {
    const factory = new Factory()
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
          sceneTree.addNewElementsFromCanonicalData(elements, properties, root)
        ).toEqual(['canonical-history-1', 'canonical-history-2'])
      })
    })

    expect(publications).toHaveLength(1)
    expect(
      publications[0]?.deliveries.map(({ channel, eventName, payload }) => ({
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
      {
        channel: SharedDataChannelNames.PROPS,
        eventName: EventTypes.ADD_PROPERTY,
        action: PROPS_ACTIONS.ADD_PROPERTY
      },
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.ADD_ELEMENT,
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT
      },
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.ADD_ELEMENT,
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT
      }
    ])
    expect(
      (
        publications[0]?.deliveries[0]?.payload as {
          data: readonly PropertyComponentRawData[]
        }
      ).data
    ).toEqual(properties)
    expect(
      (
        publications[0]?.deliveries[1]?.payload as {
          data: readonly PropertyComponentRawData[]
        }
      ).data
    ).toEqual([])

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

  it('records source properties before one exact active-property element batch', () => {
    const factory = new Factory()
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
        id: 'active-shared-value',
        type: CANONICAL_PROPERTY_TYPE,
        value: 17
      }
    ] as readonly PropertyComponentRawData[]
    const elements = [
      {
        id: 'active-history-1',
        type: CANONICAL_LEAF_TYPE,
        name: 'Active History 1',
        parentId: root.get('id'),
        visible: true,
        lock: false,
        props: { value: 'active-shared-value' }
      },
      {
        id: 'active-history-2',
        type: CANONICAL_LEAF_TYPE,
        name: 'Active History 2',
        parentId: root.get('id'),
        visible: true,
        lock: false,
        props: { value: 'active-shared-value' }
      }
    ] as unknown as readonly ElementRawData[]
    let activeProperty: ReturnType<typeof propsManager.getPropertyById>

    runWithTransactionOwner(factory.getTransactionOwner(), () => {
      runTransaction(() => {
        publishAddProperty([...properties])
        activeProperty = propsManager.getPropertyById('active-shared-value')
        expect(
          sceneTree.addNewElementsFromCanonicalDataUsingActiveProperties(
            elements,
            properties,
            root
          )
        ).toEqual(['active-history-1', 'active-history-2'])
      })
    })

    expect(propsManager.getPropertyById('active-shared-value')).toBe(
      activeProperty
    )
    expect(publications).toHaveLength(1)
    expect(
      publications[0]?.deliveries.map(({ channel, eventName, payload }) => ({
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
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.ADD_ELEMENT,
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT
      },
      {
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.ADD_ELEMENT,
        action: SCENE_TREE_ACTIONS.ADD_ELEMENT
      }
    ])
    expect(
      (
        publications[0]?.deliveries[0]?.payload as {
          data: readonly PropertyComponentRawData[]
        }
      ).data
    ).toEqual(properties)
    expect(
      publications[0]?.deliveries.filter(
        ({ channel }) => channel === SharedDataChannelNames.PROPS
      )
    ).toHaveLength(1)

    factory.undo()
    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(propsManager.save()).toEqual({})

    factory.redo()
    expect(childrenOf(sceneTree.workspace)).toEqual([
      'active-history-1',
      'active-history-2'
    ])
    expect(propsManager.save()).toEqual({
      'active-shared-value': properties[0]
    })
    expect(publications.map(({ origin }) => origin)).toEqual([
      'action',
      'undo',
      'redo'
    ])

    factory.transact.reset()
  })

  it('rolls back source properties when the active-property scene batch cannot commit', () => {
    const factory = new Factory()
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
      id: 'active-failed-value',
      type: CANONICAL_PROPERTY_TYPE,
      value: 33
    } as PropertyComponentRawData
    const element = {
      id: 'active-failed-element',
      type: CANONICAL_LEAF_TYPE,
      name: 'Active Failed Element',
      parentId: root.get('id'),
      visible: true,
      lock: false,
      props: { value: 'active-failed-value' }
    } as unknown as ElementRawData
    vi.spyOn(sceneTree, 'commitSceneTreeTransaction').mockImplementationOnce(
      () => {
        throw new Error('active scene evidence commit failed')
      }
    )

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          publishAddProperty([property])
          sceneTree.addNewElementsFromCanonicalDataUsingActiveProperties(
            [element],
            [property],
            root
          )
        })
      })
    ).toThrow('active scene evidence commit failed')

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById(element.id)).toBeUndefined()
    expect(propsManager.save()).toEqual({})
    expect(publications).toEqual([])
    factory.undo()
    expect(publications).toEqual([])

    factory.transact.reset()
  })

  it('rolls back canonical properties when scene evidence cannot commit', () => {
    const factory = new Factory()
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
    vi.spyOn(sceneTree, 'commitSceneTreeTransaction').mockImplementationOnce(
      () => {
        throw new Error('scene evidence commit failed')
      }
    )

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          sceneTree.addNewElementsFromCanonicalData(
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
            root
          )
        })
      })
    ).toThrow('scene evidence commit failed')

    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById('canonical-failed-element')).toBeUndefined()
    expect(propsManager.save()).toEqual({})
    expect(publications).toEqual([])
    factory.undo()
    expect(publications).toEqual([])

    factory.transact.reset()
  })

  it('rejects an active top-level owner without corrupting its existing element on undo', () => {
    const factory = new Factory()
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
    const activeProperty = propsManager.createProperty({
      id: 'existing-owner-value',
      type: CANONICAL_PROPERTY_TYPE,
      value: 44
    })
    propsManager.addProperty([activeProperty])
    propsManager.cleanChanges()
    const existingElement = {
      id: 'existing-owner-element',
      type: CANONICAL_LEAF_TYPE,
      name: 'Existing Owner Element',
      parentId: root.get('id'),
      visible: true,
      lock: false,
      props: { value: 'existing-owner-value' }
    } as unknown as ElementRawData
    sceneTree.addNewElement(
      existingElement as unknown as CreateElementData,
      root
    )
    sceneTree.cleanChanges()

    expect(() =>
      runWithTransactionOwner(factory.getTransactionOwner(), () => {
        runTransaction(() => {
          sceneTree.addNewElementsFromCanonicalData(
            [
              {
                ...existingElement,
                id: 'rejected-active-owner-element',
                name: 'Rejected Active Owner Element'
              }
            ],
            [],
            root
          )
        })
      })
    ).toThrow(/property owner/i)

    expect(propsManager.getPropertyById('existing-owner-value')).toBe(
      activeProperty
    )
    expect(sceneTree.getElementById('existing-owner-element')?.save()).toEqual(
      existingElement
    )
    expect(
      sceneTree.getElementById('rejected-active-owner-element')
    ).toBeUndefined()
    expect(childrenOf(sceneTree.workspace)).toEqual(['existing-owner-element'])
    expect(publications).toEqual([])
    factory.undo()
    expect(childrenOf(sceneTree.workspace)).toEqual(['existing-owner-element'])
    expect(propsManager.getPropertyById('existing-owner-value')).toBe(
      activeProperty
    )

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
