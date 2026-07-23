import { beforeEach, describe, expect, it } from 'vitest'
import {
  Factory,
  LocalSharedDataChannel,
  type SharedPublication
} from '@asyra/factory'
import sceneTree, {
  componentRegistry,
  createDynamicComponent
} from '@asyra/scene-tree'
import { runTransaction, runWithTransactionOwner } from '@asyra/reactive-events'
import {
  EntityTypes,
  SharedDataChannelNames,
  type CreateElementData,
  type ElementInstanceTypes,
  type GroupInstanceTypes
} from '@asyra/utils'

const LEAF_TYPE = 'gate3-factory-leaf'
const CONTAINER_TYPE = 'gate3-factory-container'

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
