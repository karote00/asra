import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Factory,
  LocalSharedDataChannel,
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
  EventTypes,
  runTransaction,
  runWithTransactionOwner
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
  type PropertyComponentRawData
} from '@asyra/utils'

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
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    const root = sceneTree.currentWorkspace as GroupInstanceTypes
    expect(root.get('type')).toBe(EntityTypes.WORKSPACE)
    add('target', CONTAINER_TYPE, root)
    const moved = add('moved', LEAF_TYPE, root)
    const subtree = add('subtree', CONTAINER_TYPE, root) as GroupInstanceTypes
    const firstChild = add('first-child', LEAF_TYPE, subtree)
    const nested = add('nested', CONTAINER_TYPE, subtree) as GroupInstanceTypes
    const grandchild = add('grandchild', LEAF_TYPE, nested)
    const originalRootOrder = childrenOf(sceneTree.workspace)
    const originalSubtreeOrder = childrenOf('subtree')

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
    expect(publications).toHaveLength(1)
    expect(publications[0]?.deliveries).toHaveLength(2)

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
    expect(publications).toHaveLength(2)
    expect(publications[1]?.origin).toBe('undo')

    factory.redo()

    expect(childrenOf(sceneTree.workspace)).toEqual(['target'])
    expect(childrenOf('target')).toEqual(['moved'])
    expect(sceneTree.getElementById('subtree')).toBeUndefined()
    expect(sceneTree.getElementById('first-child')).toBeUndefined()
    expect(sceneTree.getElementById('nested')).toBeUndefined()
    expect(sceneTree.getElementById('grandchild')).toBeUndefined()
    expect(publications).toHaveLength(3)
    expect(publications[2]?.origin).toBe('redo')

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
