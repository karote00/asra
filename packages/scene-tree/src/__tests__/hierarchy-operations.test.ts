import { beforeEach, describe, expect, it } from 'vitest'
import propsManager, {
  BasePropertyComponent,
  propertyComponentRegistry,
  registerPropertyComponent
} from '@asyra/props-manager'
import {
  EventTypes,
  subscribeToUpdateTransaction,
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

beforeEach(() => {
  sceneTree.reset()
  propsManager.reset()
  propertyComponentRegistry.clear()
  registerPropertyComponent(PropertyTypes.POSITION, HierarchyTestPosition)
  registerPropertyComponent(PropertyTypes.DIMENSION, HierarchyTestDimension)
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
})

describe('canonical subtree removal', () => {
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
    const result = sceneTree.removeSubtree(groupId)

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
    expect(sceneTree.getRestoreElementById(groupId, false)).toBe(group)
    expect(sceneTree.getRestoreElementById(childId, false)).toBe(child)
    expect(sceneTree.getRestoreElementById(nestedId, false)).toBe(nested)
    expect(sceneTree.getRestoreElementById(grandchildId, false)).toBe(
      grandchild
    )
    expect(
      updates.filter(({ eventName }) => eventName === EventTypes.CHANGE_SUBTREE)
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
