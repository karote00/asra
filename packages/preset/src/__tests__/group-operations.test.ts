import { describe, expect, it, vi } from 'vitest'
import type { SceneTreeRawData } from '@asyra/utils'
import { EntityTypes } from '@asyra/utils'
import {
  CONTAINER_COMPONENT_DEFINITIONS,
  GROUP_COMPONENT_DEFINITION
} from '../components'
import * as presetPublicApi from '../index'
import {
  prepareGroupOperation,
  prepareUngroupOperation,
  groupElements,
  normalizeGroupsForElements,
  ungroupElement,
  type GroupPlanningCore
} from '../components/group'

const createSnapshot = (): SceneTreeRawData => ({
  workspace: 'workspace',
  workspaceList: ['workspace'],
  elements: {
    workspace: {
      id: 'workspace',
      type: EntityTypes.WORKSPACE,
      name: 'Workspace',
      parentId: '',
      visible: true,
      lock: false,
      children: ['first', 'middle', 'last', 'outer']
    },
    first: {
      id: 'first',
      type: 'rect',
      name: 'First',
      parentId: 'workspace',
      visible: true,
      lock: false
    },
    middle: {
      id: 'middle',
      type: 'rect',
      name: 'Middle',
      parentId: 'workspace',
      visible: true,
      lock: false
    },
    last: {
      id: 'last',
      type: 'rect',
      name: 'Last',
      parentId: 'workspace',
      visible: true,
      lock: false
    },
    outer: {
      id: 'outer',
      type: EntityTypes.GROUP,
      name: 'Outer',
      parentId: 'workspace',
      visible: true,
      lock: false,
      children: ['nested-group', 'empty']
    },
    'nested-group': {
      id: 'nested-group',
      type: EntityTypes.GROUP,
      name: 'Nested Group',
      parentId: 'outer',
      visible: true,
      lock: false,
      children: ['nested-leaf']
    },
    'nested-leaf': {
      id: 'nested-leaf',
      type: 'rect',
      name: 'Nested Leaf',
      parentId: 'nested-group',
      visible: true,
      lock: false
    },
    empty: {
      id: 'empty',
      type: EntityTypes.GROUP,
      name: 'Empty Group',
      parentId: 'outer',
      visible: true,
      lock: false,
      children: []
    }
  }
})

const createCore = (snapshot: SceneTreeRawData): GroupPlanningCore => ({
  sceneTreeSaveData: () => structuredClone(snapshot)
})

describe('official Preset Group operation planning', () => {
  it('keeps one official GROUP component registration', () => {
    expect(GROUP_COMPONENT_DEFINITION.type).toBe(EntityTypes.GROUP)
    expect(GROUP_COMPONENT_DEFINITION.isContainer).toBe(true)
    expect(
      CONTAINER_COMPONENT_DEFINITIONS.filter(
        ({ type }) => type === EntityTypes.GROUP
      )
    ).toEqual([GROUP_COMPONENT_DEFINITION])
    expect(presetPublicApi.groupElements).toBe(groupElements)
    expect(presetPublicApi.ungroupElement).toBe(ungroupElement)
    expect(presetPublicApi.normalizeGroupsForElements).toBe(
      normalizeGroupsForElements
    )
  })

  it('plans non-contiguous grouping by canonical sibling order and first selected slot', () => {
    const snapshot = createSnapshot()
    const before = structuredClone(snapshot)

    const plan = prepareGroupOperation(createCore(snapshot), ['last', 'first'])

    expect(plan).toEqual({
      kind: 'group',
      parentId: 'workspace',
      groupIndex: 0,
      elementIds: ['first', 'last']
    })
    expect(snapshot).toEqual(before)
    expect(Object.isFrozen(plan)).toBe(true)
    expect(Object.isFrozen(plan.elementIds)).toBe(true)
  })

  it('plans nested and empty Group ungroup at the existing Group slot', () => {
    const core = createCore(createSnapshot())

    expect(prepareUngroupOperation(core, 'nested-group')).toEqual({
      kind: 'ungroup',
      groupId: 'nested-group',
      parentId: 'outer',
      groupIndex: 0,
      elementIds: ['nested-leaf']
    })
    expect(prepareUngroupOperation(core, 'empty')).toEqual({
      kind: 'ungroup',
      groupId: 'empty',
      parentId: 'outer',
      groupIndex: 1,
      elementIds: []
    })
  })

  it.each([
    ['empty ids', []],
    ['duplicate ids', ['first', 'first']],
    ['missing id', ['first', 'missing']],
    ['mixed parents', ['first', 'nested-leaf']]
  ])('rejects a %s request before any mutation', (_label, elementIds) => {
    const snapshot = createSnapshot()
    const before = structuredClone(snapshot)

    expect(() =>
      prepareGroupOperation(createCore(snapshot), elementIds)
    ).toThrow(/cannot prepare official Group operation/i)
    expect(snapshot).toEqual(before)
  })

  it('rejects ungroup for a non-Group or missing Group id', () => {
    const core = createCore(createSnapshot())

    expect(() => prepareUngroupOperation(core, 'first')).toThrow(
      /official Group/i
    )
    expect(() => prepareUngroupOperation(core, 'missing')).toThrow(
      /official Group/i
    )
  })
})

describe('official Preset Group geometry adapters', () => {
  it('groups canonical ids with direct-child bounds and world-position-preserving coordinates', () => {
    const snapshot = createSnapshot()
    const computed = {
      first: { x: 10, y: 20, width: 30, height: 40 },
      last: { x: 80, y: 10, width: 20, height: 15 }
    }
    const core = {
      sceneTreeSaveData: () => structuredClone(snapshot),
      getElementComputedData: vi.fn(
        (elementId: keyof typeof computed) => computed[elementId]
      ),
      createElementInParent: vi.fn(() => 'created-group'),
      moveElements: vi.fn(() => ({
        elementIds: ['first', 'last'],
        moves: []
      })),
      changeComputedData: vi.fn(),
      removeSubtree: vi.fn()
    }
    const options = { shared: 'sceneTree' }

    const result = groupElements(core as never, ['last', 'first'], options)

    expect(core.createElementInParent).toHaveBeenCalledWith(
      {
        type: EntityTypes.GROUP,
        x: 10,
        y: 10,
        width: 90,
        height: 50
      },
      'workspace',
      0,
      options
    )
    expect(core.moveElements).toHaveBeenCalledWith(
      {
        elementIds: ['first', 'last'],
        targetParentId: 'created-group',
        targetIndex: 0
      },
      options
    )
    expect(core.changeComputedData).toHaveBeenNthCalledWith(
      1,
      ['first'],
      { x: 0, y: 10 },
      options
    )
    expect(core.changeComputedData).toHaveBeenNthCalledWith(
      2,
      ['last'],
      { x: 70, y: 0 },
      options
    )
    expect(result).toEqual({
      groupId: 'created-group',
      elementIds: ['first', 'last'],
      bounds: { x: 10, y: 10, width: 90, height: 50 }
    })
  })

  it('ungroups normal and empty Groups without changing child world positions', () => {
    const snapshot = createSnapshot()
    const normalComputed = {
      'nested-group': { x: 100, y: 50, width: 20, height: 30 },
      'nested-leaf': { x: 5, y: 10, width: 20, height: 30 },
      empty: { x: 0, y: 0, width: 0, height: 0 }
    }
    const core = {
      sceneTreeSaveData: () => structuredClone(snapshot),
      getElementComputedData: vi.fn(
        (elementId: keyof typeof normalComputed) => normalComputed[elementId]
      ),
      createElementInParent: vi.fn(),
      moveElements: vi.fn(() => ({
        elementIds: ['nested-leaf'],
        moves: []
      })),
      changeComputedData: vi.fn(),
      removeSubtree: vi.fn((elementId: string) => ({
        elementId,
        removed: []
      }))
    }

    expect(ungroupElement(core as never, 'nested-group')).toEqual({
      groupId: 'nested-group',
      elementIds: ['nested-leaf'],
      removed: true
    })
    expect(core.moveElements).toHaveBeenCalledWith(
      {
        elementIds: ['nested-leaf'],
        targetParentId: 'outer',
        targetIndex: 0
      },
      undefined
    )
    expect(core.changeComputedData).toHaveBeenCalledWith(
      ['nested-leaf'],
      { x: 105, y: 60 },
      undefined
    )
    expect(core.removeSubtree).toHaveBeenCalledWith('nested-group', undefined)

    core.moveElements.mockClear()
    core.changeComputedData.mockClear()
    core.removeSubtree.mockClear()

    expect(ungroupElement(core as never, 'empty')).toEqual({
      groupId: 'empty',
      elementIds: [],
      removed: true
    })
    expect(core.moveElements).not.toHaveBeenCalled()
    expect(core.changeComputedData).not.toHaveBeenCalled()
    expect(core.removeSubtree).toHaveBeenCalledWith('empty', undefined)
  })

  it('rejects non-finite child geometry before creating a Group', () => {
    const snapshot = createSnapshot()
    const core = {
      sceneTreeSaveData: () => structuredClone(snapshot),
      getElementComputedData: vi.fn(() => ({
        x: Number.NaN,
        y: 0,
        width: 10,
        height: 10
      })),
      createElementInParent: vi.fn(),
      moveElements: vi.fn(),
      changeComputedData: vi.fn(),
      removeSubtree: vi.fn()
    }

    expect(() => groupElements(core as never, ['first'])).toThrow(
      /finite 2D geometry/i
    )
    expect(core.createElementInParent).not.toHaveBeenCalled()
  })

  it('rederives direct-child bounds through one rebasing path without a visible jump', () => {
    const snapshot = createSnapshot()
    snapshot.elements.workspace.children = ['standalone-group']
    snapshot.elements['standalone-group'] = {
      id: 'standalone-group',
      type: EntityTypes.GROUP,
      name: 'Standalone Group',
      parentId: 'workspace',
      visible: true,
      lock: false,
      children: ['first', 'last']
    }
    snapshot.elements.first.parentId = 'standalone-group'
    snapshot.elements.last.parentId = 'standalone-group'
    const computed = {
      'standalone-group': { x: 100, y: 50, width: 1, height: 1 },
      first: { x: -10, y: 20, width: 30, height: 40 },
      last: { x: 70, y: 0, width: 20, height: 15 }
    }
    const core = {
      sceneTreeSaveData: () => structuredClone(snapshot),
      getElementComputedData: vi.fn(
        (elementId: keyof typeof computed) => computed[elementId]
      ),
      createElementInParent: vi.fn(),
      moveElements: vi.fn(),
      changeComputedData: vi.fn(),
      removeSubtree: vi.fn()
    }
    const options = { shared: 'sceneTree' }

    expect(
      normalizeGroupsForElements(core as never, ['first'], options)
    ).toEqual([
      {
        groupId: 'standalone-group',
        bounds: { x: 90, y: 50, width: 100, height: 60 }
      }
    ])
    expect(core.changeComputedData).toHaveBeenNthCalledWith(
      1,
      ['standalone-group'],
      { x: 90, y: 50, width: 100, height: 60 },
      options
    )
    expect(core.changeComputedData).toHaveBeenNthCalledWith(
      2,
      ['first'],
      { x: 0, y: 20 },
      options
    )
    expect(core.changeComputedData).toHaveBeenNthCalledWith(
      3,
      ['last'],
      { x: 80, y: 0 },
      options
    )
  })
})
