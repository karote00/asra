import { describe, expect, it, vi } from 'vitest'
import type { SceneTreeRawData } from '@asyra/utils'
import { EntityTypes } from '@asyra/utils'
import {
  CONTAINER_COMPONENT_DEFINITIONS,
  GROUP_COMPONENT_DEFINITION
} from '../components/index.js'
import * as presetPublicApi from '../index.js'
import {
  prepareGroupOperation,
  prepareUngroupOperation,
  projectGroupGeometryPropertyUpdates,
  groupElements,
  moveElementsWithGroupGeometry,
  normalizeGroupsForElements,
  ungroupElement,
  type GroupHierarchyReadCore
} from '../components/group.js'

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

const createCore = (snapshot: SceneTreeRawData): GroupHierarchyReadCore => ({
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
    expect(presetPublicApi.moveElementsWithGroupGeometry).toBe(
      moveElementsWithGroupGeometry
    )
    expect(presetPublicApi.normalizeGroupsForElements).toBe(
      normalizeGroupsForElements
    )
    expect(presetPublicApi.projectGroupGeometryPropertyUpdates).toBe(
      projectGroupGeometryPropertyUpdates
    )
  })

  it('plans non-contiguous grouping by canonical sibling order and first selected slot', () => {
    const snapshot = createSnapshot()
    const before = structuredClone(snapshot)

    const preparedGroup = prepareGroupOperation(createCore(snapshot), [
      'last',
      'first'
    ])

    expect(preparedGroup).toEqual({
      kind: 'group',
      parentId: 'workspace',
      groupIndex: 0,
      elementIds: ['first', 'last']
    })
    expect(snapshot).toEqual(before)
    expect(Object.isFrozen(preparedGroup)).toBe(true)
    expect(Object.isFrozen(preparedGroup.elementIds)).toBe(true)
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
  it('returns a child-only geometry update without reading Group state', () => {
    const childIds = Array.from(
      { length: 7075 },
      (_, index) => `child-${index + 1}`
    )
    const snapshot = {
      workspaceId: 'workspace',
      elements: {
        workspace: {
          id: 'workspace',
          type: EntityTypes.WORKSPACE,
          parentId: '',
          children: ['group-1']
        },
        'group-1': {
          id: 'group-1',
          type: EntityTypes.GROUP,
          parentId: 'workspace',
          children: childIds
        },
        ...Object.fromEntries(
          childIds.map((elementId) => [
            elementId,
            {
              id: elementId,
              type: EntityTypes.RECTANGLE,
              parentId: 'group-1'
            }
          ])
        )
      }
    } as unknown as SceneTreeRawData
    const core = {
      sceneTreeSaveData: vi.fn(() => snapshot),
      getElementComputedData: vi.fn(),
      updateElementProperties: vi.fn()
    }

    expect(
      projectGroupGeometryPropertyUpdates(core, [
        {
          elementId: childIds[0],
          values: { x: 35, y: 20, width: 50 }
        }
      ])
    ).toEqual([
      {
        elementId: childIds[0],
        values: { x: 35, y: 20, width: 50 }
      }
    ])
    expect(core.sceneTreeSaveData).not.toHaveBeenCalled()
    expect(core.getElementComputedData).not.toHaveBeenCalled()
    expect(core.updateElementProperties).not.toHaveBeenCalled()
  })

  it('projects an explicit Group geometry update through nested Group owners before canonical apply', () => {
    const snapshot = createSnapshot()
    snapshot.elements.outer.children = ['nested-group']
    snapshot.elements['nested-group'].children = ['nested-leaf', 'first']
    snapshot.elements.first.parentId = 'nested-group'
    const computed = {
      outer: { x: 100, y: 50, width: 65, height: 35 },
      'nested-group': { x: 20, y: 30, width: 65, height: 35 },
      'nested-leaf': { x: 10, y: 15, width: 40, height: 25 },
      first: { x: 80, y: 10, width: 20, height: 15 }
    }
    const beforeSnapshot = structuredClone(snapshot)
    const beforeComputed = structuredClone(computed)
    const core = {
      sceneTreeSaveData: vi.fn(() => structuredClone(snapshot)),
      getElementComputedData: vi.fn((elementId: keyof typeof computed) =>
        structuredClone(computed[elementId])
      ),
      updateElementProperties: vi.fn()
    }

    const request = projectGroupGeometryPropertyUpdates(
      core,
      [
        {
          elementId: 'nested-group',
          values: { width: 50 }
        }
      ],
      ['nested-group']
    )

    expect(request).toEqual([
      {
        elementId: 'nested-group',
        values: { x: 0, y: 0, width: 90, height: 30 }
      },
      {
        elementId: 'nested-leaf',
        values: { x: 0, y: 5 }
      },
      {
        elementId: 'first',
        values: { x: 70, y: 0 }
      },
      {
        elementId: 'outer',
        values: { x: 130, y: 90, width: 90, height: 30 }
      }
    ])
    expect(new Set(request.map(({ elementId }) => elementId)).size).toBe(
      request.length
    )
    expect(core.updateElementProperties).not.toHaveBeenCalled()
    expect(snapshot).toEqual(beforeSnapshot)
    expect(computed).toEqual(beforeComputed)
  })

  it('returns non-geometry property updates without reading or mutating Group state', () => {
    const core = {
      sceneTreeSaveData: vi.fn(),
      getElementComputedData: vi.fn(),
      updateElementProperties: vi.fn()
    }

    expect(
      projectGroupGeometryPropertyUpdates(core, [
        { elementId: 'first', values: { rotation: 15 } }
      ])
    ).toEqual([{ elementId: 'first', values: { rotation: 15 } }])
    expect(core.sceneTreeSaveData).not.toHaveBeenCalled()
    expect(core.getElementComputedData).not.toHaveBeenCalled()
    expect(core.updateElementProperties).not.toHaveBeenCalled()
  })

  it('rejects duplicate or invalid later geometry targets without canonical mutation', () => {
    const snapshot = createSnapshot()
    const core = {
      sceneTreeSaveData: vi.fn(() => structuredClone(snapshot)),
      getElementComputedData: vi.fn(() => ({
        x: 0,
        y: 0,
        width: 10,
        height: 10
      })),
      updateElementProperties: vi.fn()
    }

    expect(() =>
      projectGroupGeometryPropertyUpdates(core, [
        { elementId: 'first', values: { x: 5 } },
        { elementId: 'first', values: { y: 6 } }
      ])
    ).toThrow(/unique element ids/i)
    expect(() =>
      projectGroupGeometryPropertyUpdates(
        core,
        [
          { elementId: 'first', values: { x: 5 } },
          { elementId: 'missing', values: { width: 20 } }
        ],
        ['missing']
      )
    ).toThrow(/not an official Group/i)
    expect(core.updateElementProperties).not.toHaveBeenCalled()
  })

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
      updateElementProperties: vi.fn(),
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
    expect(core.updateElementProperties).toHaveBeenCalledOnce()
    expect(core.updateElementProperties).toHaveBeenCalledWith(
      [
        { elementId: 'first', values: { x: 0, y: 10 } },
        { elementId: 'last', values: { x: 70, y: 0 } }
      ],
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
      updateElementProperties: vi.fn(),
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
    expect(core.updateElementProperties).toHaveBeenCalledWith(
      [{ elementId: 'nested-leaf', values: { x: 105, y: 60 } }],
      undefined
    )
    expect(core.removeSubtree).toHaveBeenCalledWith('nested-group', undefined)

    core.moveElements.mockClear()
    core.updateElementProperties.mockClear()
    core.removeSubtree.mockClear()

    expect(ungroupElement(core as never, 'empty')).toEqual({
      groupId: 'empty',
      elementIds: [],
      removed: true
    })
    expect(core.moveElements).not.toHaveBeenCalled()
    expect(core.updateElementProperties).not.toHaveBeenCalled()
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
      updateElementProperties: vi.fn(),
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
      updateElementProperties: vi.fn(),
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
    expect(core.updateElementProperties).toHaveBeenCalledOnce()
    expect(core.updateElementProperties).toHaveBeenCalledWith(
      [
        {
          elementId: 'standalone-group',
          values: { x: 90, y: 50, width: 100, height: 60 }
        },
        { elementId: 'first', values: { x: 0, y: 20 } },
        { elementId: 'last', values: { x: 80, y: 0 } }
      ],
      options
    )
  })

  it('rederives a changed Group itself before every ancestor Group', () => {
    const snapshot = createSnapshot()
    snapshot.elements.workspace.children = ['outer']
    snapshot.elements.outer = {
      id: 'outer',
      type: EntityTypes.GROUP,
      name: 'Outer Group',
      parentId: 'workspace',
      visible: true,
      lock: false,
      children: ['inner']
    }
    snapshot.elements.inner = {
      id: 'inner',
      type: EntityTypes.GROUP,
      name: 'Inner Group',
      parentId: 'outer',
      visible: true,
      lock: false,
      children: ['first']
    }
    snapshot.elements.first.parentId = 'inner'
    const computed = {
      outer: { x: 100, y: 50, width: 999, height: 999 },
      inner: { x: 20, y: 30, width: 999, height: 999 },
      first: { x: 10, y: 15, width: 40, height: 25 }
    }
    const core = {
      sceneTreeSaveData: () => structuredClone(snapshot),
      getElementComputedData: vi.fn(
        (elementId: keyof typeof computed) => computed[elementId]
      ),
      createElementInParent: vi.fn(),
      moveElements: vi.fn(),
      updateElementProperties: vi.fn(
        (
          updates: readonly {
            elementId: keyof typeof computed
            values: Partial<(typeof computed)[keyof typeof computed]>
          }[]
        ) =>
          updates.forEach(({ elementId, values }) => {
            Object.assign(computed[elementId], values)
          })
      ),
      removeSubtree: vi.fn()
    }

    expect(normalizeGroupsForElements(core as never, ['inner'])).toEqual([
      {
        groupId: 'inner',
        bounds: { x: 30, y: 45, width: 40, height: 25 }
      },
      {
        groupId: 'outer',
        bounds: { x: 130, y: 95, width: 40, height: 25 }
      }
    ])
    expect(computed).toEqual({
      outer: { x: 130, y: 95, width: 40, height: 25 },
      inner: { x: 0, y: 0, width: 40, height: 25 },
      first: { x: 0, y: 0, width: 40, height: 25 }
    })
    expect(core.updateElementProperties).toHaveBeenCalledOnce()
  })

  it('rederives every nested ancestor after a leaf geometry change', () => {
    const snapshot = createSnapshot()
    snapshot.elements.workspace.children = ['outer']
    snapshot.elements.outer = {
      id: 'outer',
      type: EntityTypes.GROUP,
      name: 'Outer Group',
      parentId: 'workspace',
      visible: true,
      lock: false,
      children: ['inner']
    }
    snapshot.elements.inner = {
      id: 'inner',
      type: EntityTypes.GROUP,
      name: 'Inner Group',
      parentId: 'outer',
      visible: true,
      lock: false,
      children: ['first']
    }
    snapshot.elements.first.parentId = 'inner'
    const computed = {
      outer: { x: 100, y: 50, width: 40, height: 25 },
      inner: { x: 0, y: 0, width: 40, height: 25 },
      first: { x: 35, y: 20, width: 40, height: 25 }
    }
    const core = {
      sceneTreeSaveData: () => structuredClone(snapshot),
      getElementComputedData: vi.fn(
        (elementId: keyof typeof computed) => computed[elementId]
      ),
      createElementInParent: vi.fn(),
      moveElements: vi.fn(),
      updateElementProperties: vi.fn(
        (
          updates: readonly {
            elementId: keyof typeof computed
            values: Partial<(typeof computed)[keyof typeof computed]>
          }[]
        ) =>
          updates.forEach(({ elementId, values }) => {
            Object.assign(computed[elementId], values)
          })
      ),
      removeSubtree: vi.fn()
    }

    expect(normalizeGroupsForElements(core as never, ['first'])).toEqual([
      {
        groupId: 'inner',
        bounds: { x: 35, y: 20, width: 40, height: 25 }
      },
      {
        groupId: 'outer',
        bounds: { x: 135, y: 70, width: 40, height: 25 }
      }
    ])
    expect(computed).toEqual({
      outer: { x: 135, y: 70, width: 40, height: 25 },
      inner: { x: 0, y: 0, width: 40, height: 25 },
      first: { x: 0, y: 0, width: 40, height: 25 }
    })
    expect(core.updateElementProperties).toHaveBeenCalledOnce()
  })

  it('reparents through official Groups without changing child world positions', () => {
    const snapshot = createSnapshot()
    snapshot.elements.workspace.children = ['source', 'target']
    snapshot.elements.source = {
      id: 'source',
      type: EntityTypes.GROUP,
      name: 'Source',
      parentId: 'workspace',
      visible: true,
      lock: false,
      children: ['first']
    }
    snapshot.elements.target = {
      id: 'target',
      type: EntityTypes.GROUP,
      name: 'Target',
      parentId: 'workspace',
      visible: true,
      lock: false,
      children: ['last']
    }
    snapshot.elements.first.parentId = 'source'
    snapshot.elements.first.type = 'vector'
    snapshot.elements.last.parentId = 'target'
    const vectorPoints = {
      anchor: {
        id: 'anchor',
        kind: 'anchor',
        x: 110,
        y: 0
      },
      control: {
        id: 'control',
        kind: 'control',
        x: 118,
        y: 4
      }
    }
    const computed = {
      source: { x: 100, y: 0, width: 10, height: 10 },
      target: { x: 300, y: 0, width: 20, height: 20 },
      first: {
        x: 10,
        y: 0,
        width: 10,
        height: 10,
        pointCoordinateSpace: 'workspace',
        points: vectorPoints
      },
      last: { x: 0, y: 0, width: 20, height: 20 }
    }
    const core = {
      sceneTreeSaveData: () => structuredClone(snapshot),
      getElementComputedData: vi.fn((elementId: keyof typeof computed) =>
        structuredClone(computed[elementId])
      ),
      createElementInParent: vi.fn(),
      moveElements: vi.fn(() => {
        snapshot.elements.source.children = []
        snapshot.elements.target.children = ['last', 'first']
        snapshot.elements.first.parentId = 'target'
        return {
          elementIds: ['first'],
          moves: [
            {
              elementId: 'first',
              before: { parentId: 'source', index: 0 },
              after: { parentId: 'target', index: 1 }
            }
          ]
        }
      }),
      updateElementProperties: vi.fn(
        (
          updates: readonly {
            elementId: keyof typeof computed
            values: Partial<(typeof computed)[keyof typeof computed]>
          }[]
        ) =>
          updates.forEach(({ elementId, values }) => {
            Object.assign(computed[elementId], values)
          })
      ),
      removeSubtree: vi.fn()
    }

    expect(
      moveElementsWithGroupGeometry(core as never, {
        elementIds: ['first'],
        targetParentId: 'target',
        targetIndex: 1
      })
    ).toEqual({
      elementIds: ['first'],
      moves: [
        {
          elementId: 'first',
          before: { parentId: 'source', index: 0 },
          after: { parentId: 'target', index: 1 }
        }
      ]
    })
    expect(computed.source).toEqual({
      x: 100,
      y: 0,
      width: 0,
      height: 0
    })
    expect(computed.target).toEqual({
      x: 110,
      y: 0,
      width: 210,
      height: 20
    })
    expect(computed.first).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      pointCoordinateSpace: 'workspace',
      points: vectorPoints
    })
    expect(computed.first.points).toBe(vectorPoints)
    expect(computed.last).toEqual({
      x: 190,
      y: 0,
      width: 20,
      height: 20
    })
    expect(core.updateElementProperties).toHaveBeenCalledOnce()
    expect(core.updateElementProperties).toHaveBeenCalledWith(
      [
        { elementId: 'first', values: { x: 0, y: 0 } },
        {
          elementId: 'source',
          values: { x: 100, y: 0, width: 0, height: 0 }
        },
        {
          elementId: 'target',
          values: { x: 110, y: 0, width: 210, height: 20 }
        },
        { elementId: 'last', values: { x: 190, y: 0 } }
      ],
      undefined
    )
    for (const [updates] of core.updateElementProperties.mock.calls) {
      for (const update of updates) {
        expect(update).not.toHaveProperty('records')
        expect(update.values).not.toHaveProperty('points')
        expect(update.values).not.toHaveProperty('segments')
        expect(update.values).not.toHaveProperty('networks')
      }
    }
  })
})
