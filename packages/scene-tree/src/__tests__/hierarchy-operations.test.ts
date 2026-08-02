import { beforeEach, describe, expect, it } from 'vitest'
import propsManager, {
  BasePropertyComponent,
  PropsManager,
  propertyComponentRegistry,
  registerPropertyComponent
} from '@asyra/props-manager'
import {
  EventTypes,
  publishEventToObservers,
  runWithTransactionOwner,
  subscribeToUpdateTransaction,
  type TransactionOwner,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  DefaultDimensionData,
  DefaultPositionData,
  EntityTypes,
  PropertyTypes,
  type DataTypes,
  type DimensionAttrs,
  type DimensionComponentRawData,
  type ElementInstanceTypes,
  type GroupInstanceTypes,
  type PositionAttrs,
  type PositionComponentRawData,
  type Unit
} from '@asyra/utils'
import sceneTree, { SceneTree } from '../sceneTree'
import Element from '../components/element'
import Group from '../components/group'
import componentRegistry from '../component-registry'

class HierarchyTestElement extends Element {
  _init(): void {
    super._init()
    this.data.type = 'hierarchy-test-element'
  }
}

class HierarchyTestGroup extends Group {
  _init(): void {
    super._init()
    this.data.type = EntityTypes.GROUP
  }
}

class HierarchyTestPosition extends BasePropertyComponent<PositionAttrs> {
  data: PositionAttrs = {
    id: '',
    type: PropertyTypes.POSITION,
    ...DefaultPositionData
  }

  constructor(data: Partial<PositionAttrs>) {
    super()
    this.load(data as PositionComponentRawData)
  }

  load(data: PositionComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.assignLoadedValue('x', data.x)
    this.assignLoadedValue('y', data.y)
    this.assignLoadedValue('xUnit', data.xUnit)
    this.assignLoadedValue('yUnit', data.yUnit)
  }

  getValue(): Record<string, DataTypes> {
    return { x: this.data.x, y: this.data.y }
  }

  getUnit(): Record<string, Unit> {
    return { xUnit: this.data.xUnit, yUnit: this.data.yUnit }
  }
}

class HierarchyTestDimension extends BasePropertyComponent<DimensionAttrs> {
  data: DimensionAttrs = {
    id: '',
    type: PropertyTypes.DIMENSION,
    ...DefaultDimensionData
  }

  constructor(data: Partial<DimensionAttrs>) {
    super()
    this.load(data as DimensionComponentRawData)
  }

  load(data: DimensionComponentRawData): void {
    this.data.id = typeof data.id === 'string' ? data.id : this.data.id
    this.assignLoadedValue('width', data.width)
    this.assignLoadedValue('height', data.height)
    this.assignLoadedValue('widthUnit', data.widthUnit)
    this.assignLoadedValue('heightUnit', data.heightUnit)
  }

  getValue(): Record<string, DataTypes> {
    return { width: this.data.width, height: this.data.height }
  }

  getUnit(): Record<string, Unit> {
    return {
      widthUnit: this.data.widthUnit,
      heightUnit: this.data.heightUnit
    }
  }
}

const workspace = (): GroupInstanceTypes =>
  sceneTree.currentWorkspace as GroupInstanceTypes

const addElement = (
  element: ElementInstanceTypes,
  parent: GroupInstanceTypes = workspace(),
  index = -1
): string => {
  parent.addElement(element, index)
  sceneTree.addToMap(element)
  sceneTree.cleanChanges()
  return element.get('id')
}

const childrenOf = (parentId: string): string[] => [
  ...(sceneTree.getElementById(parentId) as GroupInstanceTypes).get('children')
]

const snapshotHierarchy = () =>
  [...sceneTree.getAllElements().entries()]
    .map(([id, element]) => ({
      id,
      parentId: element.get('parentId'),
      children:
        element.get('type') === EntityTypes.WORKSPACE ||
        element.get('type') === EntityTypes.GROUP
          ? [...(element as GroupInstanceTypes).get('children')]
          : undefined
    }))
    .sort((left, right) => left.id.localeCompare(right.id))

const sceneMutationTransactionOwner = {
  startTransaction: () => undefined,
  updateTransactionBatch: (events: readonly UpdateTransactionEvent[]) => {
    events.forEach(publishEventToObservers)
  },
  endTransaction: () => undefined,
  undo: () => undefined,
  redo: () => undefined
} as unknown as TransactionOwner

const removeSubtree = (
  owner: SceneTree,
  elementId: string
): ReturnType<SceneTree['removeSubtree']> =>
  runWithTransactionOwner(sceneMutationTransactionOwner, () =>
    owner.removeSubtree(elementId)
  )

beforeEach(() => {
  sceneTree.reset()
  propsManager.reset()
  propertyComponentRegistry.clear()
  registerPropertyComponent(PropertyTypes.POSITION, HierarchyTestPosition)
  registerPropertyComponent(PropertyTypes.DIMENSION, HierarchyTestDimension)
  if (!componentRegistry.has('hierarchy-test-element')) {
    componentRegistry.register({
      type: 'hierarchy-test-element',
      idPrefix: 'hierarchy-test-element',
      namePrefix: 'Hierarchy Test Element',
      constructor: HierarchyTestElement,
      properties: [],
      defaults: {}
    })
  }

  if (!componentRegistry.has(EntityTypes.GROUP)) {
    componentRegistry.register({
      type: EntityTypes.GROUP,
      idPrefix: 'group',
      namePrefix: 'Group',
      constructor: HierarchyTestGroup,
      properties: [],
      defaults: {},
      isContainer: true
    })
  }
  sceneTree.init()
  sceneTree.cleanChanges()
})

describe('canonical hierarchy move', () => {
  it('canonicalizes sibling order for non-contiguous cross-parent moves and preserves identity', () => {
    const target = new HierarchyTestGroup()
    const targetId = addElement(target)
    const first = new HierarchyTestElement()
    const middle = new HierarchyTestElement()
    const last = new HierarchyTestElement()
    const firstId = addElement(first)
    const middleId = addElement(middle)
    const lastId = addElement(last)

    const result = sceneTree.moveElements({
      elementIds: [lastId, firstId],
      targetParentId: targetId,
      targetIndex: 0
    })

    expect(result.elementIds).toEqual([firstId, lastId])
    expect(childrenOf(sceneTree.workspace)).toEqual([targetId, middleId])
    expect(childrenOf(targetId)).toEqual([firstId, lastId])
    expect(result.moves).toEqual([
      {
        elementId: firstId,
        before: { parentId: sceneTree.workspace, index: 1 },
        after: { parentId: targetId, index: 0 }
      },
      {
        elementId: lastId,
        before: { parentId: sceneTree.workspace, index: 3 },
        after: { parentId: targetId, index: 1 }
      }
    ])
    expect(sceneTree.getElementById(firstId)).toBe(first)
    expect(sceneTree.getElementById(lastId)).toBe(last)
  })

  it('uses a final-target-list index for same-parent reorder and treats the exact order as a no-op', () => {
    const firstId = addElement(new HierarchyTestElement())
    const secondId = addElement(new HierarchyTestElement())
    const thirdId = addElement(new HierarchyTestElement())
    const fourthId = addElement(new HierarchyTestElement())

    sceneTree.moveElements({
      elementIds: [thirdId, secondId],
      targetParentId: sceneTree.workspace,
      targetIndex: 0
    })

    expect(childrenOf(sceneTree.workspace)).toEqual([
      secondId,
      thirdId,
      firstId,
      fourthId
    ])

    const noOp = sceneTree.moveElements({
      elementIds: [secondId, thirdId],
      targetParentId: sceneTree.workspace,
      targetIndex: 0
    })

    expect(noOp.moves).toEqual([])
    expect(childrenOf(sceneTree.workspace)).toEqual([
      secondId,
      thirdId,
      firstId,
      fourthId
    ])
  })

  it.each([
    ['empty ids', () => ({ elementIds: [] })],
    ['duplicate ids', (ids: string[]) => ({ elementIds: [ids[0], ids[0]] })],
    ['missing id', () => ({ elementIds: ['missing-element'] })],
    ['workspace movement', () => ({ elementIds: [sceneTree.workspace] })],
    ['missing target', () => ({ targetParentId: 'missing-parent' })],
    ['non-container target', (ids: string[]) => ({ targetParentId: ids[1] })],
    ['negative index', () => ({ targetIndex: -1 })],
    ['fractional index', () => ({ targetIndex: 0.5 })],
    ['out-of-range index', () => ({ targetIndex: 3 })]
  ])('rejects %s before the first mutation', (_label, overrideFactory) => {
    const firstId = addElement(new HierarchyTestElement())
    const secondId = addElement(new HierarchyTestElement())
    const before = snapshotHierarchy()
    const override = overrideFactory([firstId, secondId])

    expect(() =>
      sceneTree.moveElements({
        elementIds: [firstId],
        targetParentId: sceneTree.workspace,
        targetIndex: 1,
        ...override
      })
    ).toThrow()
    expect(snapshotHierarchy()).toEqual(before)
  })

  it('rejects mixed parents, self-parenting, descendant cycles, and corrupt duplicate membership before mutation', () => {
    const outer = new HierarchyTestGroup()
    const outerId = addElement(outer)
    const inner = new HierarchyTestGroup()
    const innerId = addElement(inner, outer)
    const rootLeafId = addElement(new HierarchyTestElement())
    const nestedLeafId = addElement(new HierarchyTestElement(), inner)

    const expectRejectedWithoutMutation = (
      request: Parameters<typeof sceneTree.moveElements>[0]
    ) => {
      const before = snapshotHierarchy()
      expect(() => sceneTree.moveElements(request)).toThrow()
      expect(snapshotHierarchy()).toEqual(before)
    }

    expectRejectedWithoutMutation({
      elementIds: [rootLeafId, nestedLeafId],
      targetParentId: outerId,
      targetIndex: 1
    })
    expectRejectedWithoutMutation({
      elementIds: [outerId],
      targetParentId: outerId,
      targetIndex: 0
    })
    expectRejectedWithoutMutation({
      elementIds: [outerId],
      targetParentId: innerId,
      targetIndex: 1
    })

    const workspaceChildren = childrenOf(sceneTree.workspace)
    workspaceChildren.push(rootLeafId)
    workspace().set('children', workspaceChildren)
    sceneTree.cleanChanges()
    const corruptBefore = snapshotHierarchy()
    expect(() =>
      sceneTree.moveElements({
        elementIds: [outerId],
        targetParentId: sceneTree.workspace,
        targetIndex: 0
      })
    ).toThrow()
    expect(snapshotHierarchy()).toEqual(corruptBefore)
  })

  it.each(['mixed target parents', 'duplicate target index'] as const)(
    'rejects exact hierarchy evidence with %s before mutation',
    (failureKind) => {
      const firstTargetId = addElement(new HierarchyTestGroup())
      const secondTargetId = addElement(new HierarchyTestGroup())
      const firstId = addElement(new HierarchyTestElement())
      const secondId = addElement(new HierarchyTestElement())
      const workspaceChildren = childrenOf(sceneTree.workspace)
      const before = snapshotHierarchy()
      const moves = [
        {
          elementId: firstId,
          before: {
            parentId: sceneTree.workspace,
            index: workspaceChildren.indexOf(firstId)
          },
          after: { parentId: firstTargetId, index: 0 }
        },
        {
          elementId: secondId,
          before: {
            parentId: sceneTree.workspace,
            index: workspaceChildren.indexOf(secondId)
          },
          after: {
            parentId:
              failureKind === 'mixed target parents'
                ? secondTargetId
                : firstTargetId,
            index: 0
          }
        }
      ]

      expect(() =>
        runWithTransactionOwner(sceneMutationTransactionOwner, () =>
          sceneTree.applyHierarchyMoves(moves)
        )
      ).toThrow(/canonical target/i)
      expect(snapshotHierarchy()).toEqual(before)
    }
  )
})

describe('canonical subtree removal', () => {
  it('captures detached post-delete root-parent order evidence at mutation time', () => {
    const beforeSiblingId = addElement(new HierarchyTestElement())
    const groupId = addElement(new HierarchyTestGroup())
    const afterSiblingId = addElement(new HierarchyTestElement())
    const updates: UpdateTransactionEvent[] = []
    const subscription = subscribeToUpdateTransaction((event) =>
      updates.push(event)
    )

    const result = removeSubtree(sceneTree, groupId)
    const published = updates.find(
      ({ eventName, payload }) =>
        eventName === EventTypes.CHANGE_SUBTREE &&
        (payload as { elementId?: string }).elementId === groupId
    )?.payload as
      | {
          rootParentChildrenAfter: readonly string[]
        }
      | undefined
    subscription.unsubscribe()

    expect(result.rootParentChildrenAfter).toEqual([
      beforeSiblingId,
      afterSiblingId
    ])
    expect(published?.rootParentChildrenAfter).toEqual([
      beforeSiblingId,
      afterSiblingId
    ])
    expect(Object.isFrozen(result.rootParentChildrenAfter)).toBe(true)
    expect(Object.isFrozen(published?.rootParentChildrenAfter)).toBe(true)

    addElement(new HierarchyTestElement())
    expect(result.rootParentChildrenAfter).toEqual([
      beforeSiblingId,
      afterSiblingId
    ])
    expect(published?.rootParentChildrenAfter).toEqual([
      beforeSiblingId,
      afterSiblingId
    ])
  })

  it('removes descendants before their containers and keeps exact instances available for restoration', () => {
    const group = new HierarchyTestGroup()
    const groupId = addElement(group)
    const child = new HierarchyTestElement()
    const childId = addElement(child, group)
    const nested = new HierarchyTestGroup()
    const nestedId = addElement(nested, group)
    const grandchild = new HierarchyTestElement()
    const grandchildId = addElement(grandchild, nested)

    const updates: UpdateTransactionEvent[] = []
    const subscription = subscribeToUpdateTransaction((event) =>
      updates.push(event)
    )
    const before = snapshotHierarchy()
    const beforeProps = propsManager.save()
    const result = removeSubtree(sceneTree, groupId)

    expect(result.removed.map(({ elementId }) => elementId)).toEqual([
      childId,
      grandchildId,
      nestedId,
      groupId
    ])
    expect(childrenOf(sceneTree.workspace)).toEqual([])
    expect(sceneTree.getElementById(groupId)).toBeUndefined()
    expect(sceneTree.getElementById(childId)).toBeUndefined()
    expect(sceneTree.getElementById(nestedId)).toBeUndefined()
    expect(sceneTree.getElementById(grandchildId)).toBeUndefined()
    expect(propsManager.save()).toEqual(beforeProps)
    expect(sceneTree.getRestoreElementById(groupId, false)).toBe(group)
    expect(sceneTree.getRestoreElementById(childId, false)).toBe(child)
    expect(sceneTree.getRestoreElementById(nestedId, false)).toBe(nested)
    expect(sceneTree.getRestoreElementById(grandchildId, false)).toBe(
      grandchild
    )
    expect(
      updates.filter(
        ({ eventName, payload }) =>
          eventName === EventTypes.CHANGE_SUBTREE &&
          (payload as { elementId?: string }).elementId === groupId
      )
    ).toHaveLength(1)

    sceneTree.restoreSubtree(result.removed)

    expect(snapshotHierarchy()).toEqual(before)
    expect(sceneTree.getElementById(groupId)).toBe(group)
    expect(sceneTree.getElementById(childId)).toBe(child)
    expect(sceneTree.getElementById(nestedId)).toBe(nested)
    expect(sceneTree.getElementById(grandchildId)).toBe(grandchild)
    subscription.unsubscribe()
  })
})

describe('Scene Tree restore preflight', () => {
  const preflight = (snapshot: ReturnType<typeof sceneTree.removeSubtree>) =>
    (
      sceneTree as unknown as {
        preflightRestoreSubtree: (
          input: ReturnType<typeof sceneTree.removeSubtree>
        ) => {
          elementId: string
          entries: readonly {
            elementId: string
            strategy: 'reuse' | 'materialize'
          }[]
        }
      }
    ).preflightRestoreSubtree(snapshot)
  const apply = (
    owner: SceneTree,
    preparedRestore: ReturnType<typeof preflight>
  ) =>
    (
      owner as unknown as {
        applyRestoreSubtree: (
          artifact: ReturnType<typeof preflight>
        ) => ReturnType<typeof sceneTree.removeSubtree>
      }
    ).applyRestoreSubtree(preparedRestore)
  const restorePropertyTombstones = (
    manager: PropsManager,
    snapshot: ReturnType<typeof sceneTree.removeSubtree>
  ) => {
    snapshot.removed.forEach(({ data }) => {
      Object.values(data.props ?? {}).forEach((componentId) => {
        const component = manager.getRestoreComponentById(componentId)
        if (component) manager.addToMap(component)
      })
    })
    manager.cleanChanges()
  }

  it('prepares exact materialization when no deleted runtime instances exist', () => {
    const beforeSiblingId = addElement(new HierarchyTestElement())
    const group = new HierarchyTestGroup()
    const groupId = addElement(group)
    const childId = addElement(new HierarchyTestElement(), group)
    const afterSiblingId = addElement(new HierarchyTestElement())
    const snapshot = removeSubtree(sceneTree, groupId)
    sceneTree._deletedMap.clear()
    const before = snapshotHierarchy()

    const preparedRestore = preflight(snapshot)

    expect(preparedRestore.elementId).toBe(groupId)
    expect(preparedRestore.entries).toEqual([
      { elementId: childId, strategy: 'materialize' },
      { elementId: groupId, strategy: 'materialize' }
    ])
    expect(snapshot.rootParentChildrenAfter).toEqual([
      beforeSiblingId,
      afterSiblingId
    ])
    expect(snapshotHierarchy()).toEqual(before)
  })

  it('selects compatible tombstones and rejects incompatible owner state without mutation', () => {
    const group = new HierarchyTestGroup()
    const groupId = addElement(group)
    const childId = addElement(new HierarchyTestElement(), group)
    const snapshot = removeSubtree(sceneTree, groupId)
    const before = snapshotHierarchy()

    expect(preflight(snapshot).entries).toEqual([
      { elementId: childId, strategy: 'reuse' },
      { elementId: groupId, strategy: 'reuse' }
    ])

    sceneTree
      .getRestoreElementById(childId, false)
      .set('visible', false, { undoable: false })
    const incompatibleBefore = snapshotHierarchy()
    expect(() => preflight(snapshot)).toThrow(/incompatible tombstone/i)
    expect(snapshotHierarchy()).toEqual(incompatibleBefore)
    expect(snapshotHierarchy()).toEqual(before)
  })

  it('rejects malformed, stale, and colliding snapshots before hierarchy mutation', () => {
    const beforeSiblingId = addElement(new HierarchyTestElement())
    const group = new HierarchyTestGroup()
    const groupId = addElement(group)
    const childId = addElement(new HierarchyTestElement(), group)
    const afterSiblingId = addElement(new HierarchyTestElement())
    const snapshot = removeSubtree(sceneTree, groupId)
    const before = snapshotHierarchy()
    const clone = () => structuredClone(snapshot)
    const expectRejected = (
      invalid: ReturnType<typeof sceneTree.removeSubtree>,
      pattern: RegExp
    ) => {
      expect(() => preflight(invalid)).toThrow(pattern)
      expect(snapshotHierarchy()).toEqual(before)
    }

    const duplicate = clone()
    duplicate.removed = [...duplicate.removed, duplicate.removed[0]]
    expectRejected(duplicate, /duplicate/i)

    const inconsistentChildren = clone()
    const inconsistentRoot = inconsistentChildren.removed.find(
      ({ elementId }) => elementId === groupId
    )
    if (inconsistentRoot && 'children' in inconsistentRoot.data) {
      inconsistentRoot.data.children = ['missing-child']
    }
    expectRejected(inconsistentChildren, /child order/i)

    const missingParent = clone()
    const missingRoot = missingParent.removed.find(
      ({ elementId }) => elementId === groupId
    )
    if (missingRoot) {
      missingRoot.parentId = 'missing-parent'
      missingRoot.data.parentId = 'missing-parent'
    }
    expectRejected(missingParent, /missing.*parent/i)

    const invalidRegistration = clone()
    const invalidChild = invalidRegistration.removed.find(
      ({ elementId }) => elementId === childId
    )
    if (invalidChild) invalidChild.data.type = 'unregistered-element'
    expectRejected(invalidRegistration, /unregistered/i)

    expect(snapshot.rootParentChildrenAfter).toEqual([
      beforeSiblingId,
      afterSiblingId
    ])
    addElement(new HierarchyTestElement())
    const staleBefore = snapshotHierarchy()
    expect(() => preflight(snapshot)).toThrow(/stale.*root-parent order/i)
    expect(snapshotHierarchy()).toEqual(staleBefore)
  })

  it('rejects an active stable-id collision before hierarchy mutation', () => {
    const group = new HierarchyTestGroup()
    const groupId = addElement(group)
    const snapshot = removeSubtree(sceneTree, groupId)
    addElement(new HierarchyTestGroup({ id: groupId }))
    const before = snapshotHierarchy()

    expect(() => preflight(snapshot)).toThrow(/active element/i)
    expect(snapshotHierarchy()).toEqual(before)
  })

  it('materializes the exact tombstone-free subtree once after Props are active', () => {
    const beforeSiblingId = addElement(new HierarchyTestElement())
    const group = new HierarchyTestGroup()
    const groupId = addElement(group)
    const childId = addElement(new HierarchyTestElement(), group)
    const afterSiblingId = addElement(new HierarchyTestElement())
    const expectedHierarchy = snapshotHierarchy()
    const snapshot = removeSubtree(sceneTree, groupId)
    restorePropertyTombstones(propsManager, snapshot)
    sceneTree._deletedMap.clear()
    const preparedRestore = preflight(snapshot)

    expect(apply(sceneTree, preparedRestore)).toEqual(snapshot)
    expect(snapshotHierarchy()).toEqual(expectedHierarchy)
    expect(childrenOf(sceneTree.workspace)).toEqual([
      beforeSiblingId,
      groupId,
      afterSiblingId
    ])
    expect(childrenOf(groupId)).toEqual([childId])
    snapshot.removed.forEach(({ elementId, data }) => {
      expect(sceneTree.getElementById(elementId)?.save()).toEqual(data)
    })
    expect(() => apply(sceneTree, preparedRestore)).toThrow(
      /owner-issued one-shot/i
    )
  })

  it('reuses compatible Scene Tree tombstone identities', () => {
    const group = new HierarchyTestGroup()
    const groupId = addElement(group)
    const child = new HierarchyTestElement()
    const childId = addElement(child, group)
    const snapshot = removeSubtree(sceneTree, groupId)
    restorePropertyTombstones(propsManager, snapshot)
    const preparedRestore = preflight(snapshot)

    apply(sceneTree, preparedRestore)

    expect(sceneTree.getElementById(groupId)).toBe(group)
    expect(sceneTree.getElementById(childId)).toBe(child)
  })

  it('rejects a foreign or stale prepared restore without partial hierarchy', () => {
    const groupId = addElement(new HierarchyTestGroup())
    const snapshot = removeSubtree(sceneTree, groupId)
    restorePropertyTombstones(propsManager, snapshot)
    sceneTree._deletedMap.clear()
    const preparedRestore = preflight(snapshot)
    const foreignTree = new SceneTree(new PropsManager())
    foreignTree.init()

    expect(() => apply(foreignTree, preparedRestore)).toThrow(
      /owner-issued one-shot/i
    )
    const staleSiblingId = addElement(new HierarchyTestElement())
    const before = snapshotHierarchy()
    expect(() => apply(sceneTree, preparedRestore)).toThrow(
      /stale.*root-parent order/i
    )
    expect(snapshotHierarchy()).toEqual(before)
    expect(sceneTree.getElementById(staleSiblingId)).toBeDefined()
  })

  it('materializes only inside the issuing Scene Tree and Props composition', () => {
    const firstProps = new PropsManager()
    const secondProps = new PropsManager()
    const firstTree = new SceneTree(firstProps)
    const secondTree = new SceneTree(secondProps)
    firstTree.init()
    secondTree.init()
    const sharedData = {
      id: 'shared-group',
      type: EntityTypes.GROUP,
      name: 'Shared Group',
      visible: true,
      lock: false,
      x: 0,
      y: 0
    }
    firstTree.addNewElement(sharedData)
    secondTree.addNewElement(sharedData)
    const secondIdentity = secondTree.getElementById('shared-group')
    const secondPropsBefore = secondProps.save()
    const snapshot = removeSubtree(firstTree, 'shared-group')
    restorePropertyTombstones(firstProps, snapshot)
    firstTree._deletedMap.clear()
    const preparedRestore = firstTree.preflightRestoreSubtree(snapshot)

    firstTree.applyRestoreSubtree(preparedRestore)

    expect(firstTree.getElementById('shared-group')?.save()).toEqual(
      snapshot.removed[0].data
    )
    expect(secondTree.getElementById('shared-group')).toBe(secondIdentity)
    expect(secondProps.save()).toEqual(secondPropsBefore)
    Object.values(snapshot.removed[0].data.props ?? {}).forEach(
      (componentId) => {
        expect(firstProps.getPropertyById(componentId)).toBeDefined()
        expect(secondProps.getPropertyById(componentId)).toBeUndefined()
      }
    )
  })
})

describe('Scene Tree instance isolation', () => {
  it('does not share hierarchy state between instances', () => {
    const firstTree = new SceneTree()
    const secondTree = new SceneTree()

    firstTree.init()
    secondTree.init()

    expect(firstTree.workspace).not.toBe(secondTree.workspace)
    expect(firstTree.getAllElements()).not.toBe(secondTree.getAllElements())
    expect([...firstTree.getAllElements().keys()]).not.toEqual([
      ...secondTree.getAllElements().keys()
    ])
  })
})
