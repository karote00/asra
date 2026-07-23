import { describe, expect, it } from 'vitest'
import type { SceneTreeRawData } from '@asyra/utils'
import { EntityTypes } from '@asyra/utils'
import {
  CONTAINER_COMPONENT_DEFINITIONS,
  GROUP_COMPONENT_DEFINITION
} from '../components'
import {
  prepareGroupOperation,
  prepareUngroupOperation,
  type GroupOperationCore
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

const createCore = (snapshot: SceneTreeRawData): GroupOperationCore => ({
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
