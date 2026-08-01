import {
  EntityTypes,
  type ElementRawData,
  type GroupRawData
} from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import type { ResolvedLayerMoveSource } from '../layer-move-source'
import { projectLayerDropIntent } from '../layer-drop-intent'

type ProjectedElement = Partial<ElementRawData & GroupRawData>

const element = (
  id: string,
  parentId: string,
  overrides: Partial<ProjectedElement> = {}
): ProjectedElement => ({
  id,
  name: id,
  type: EntityTypes.ELEMENT,
  parentId,
  lock: false,
  visible: true,
  ...overrides
})

const elementDataMap: Record<string, ProjectedElement> = {
  a: element('a', 'workspace'),
  b: element('b', 'workspace'),
  group: element('group', 'workspace', {
    type: EntityTypes.GROUP,
    children: ['g1', 'nested', 'g2']
  }),
  g1: element('g1', 'group'),
  nested: element('nested', 'group', {
    type: EntityTypes.GROUP,
    children: ['leaf']
  }),
  leaf: element('leaf', 'nested'),
  g2: element('g2', 'group'),
  frame: element('frame', 'workspace', {
    type: EntityTypes.FRAME,
    children: []
  }),
  lockedGroup: element('lockedGroup', 'workspace', {
    type: EntityTypes.GROUP,
    lock: true,
    children: []
  }),
  c: element('c', 'workspace')
}
const flattenedIds = [
  'a',
  'b',
  'group',
  'g1',
  'nested',
  'leaf',
  'g2',
  'frame',
  'lockedGroup',
  'c'
]

const source = (
  elementIds: string[],
  sourceParentId = 'workspace'
): ResolvedLayerMoveSource => ({
  elementIds,
  sourceParentId,
  preSessionSelection: [...elementIds],
  requestedSourceSelection: [...elementIds],
  replacesSelection: false
})

describe('Layers advisory hierarchy drop projection', () => {
  it('calculates same-parent before and after indexes from the final list', () => {
    expect(
      projectLayerDropIntent({
        target: { kind: 'row', elementId: 'a', zone: 'before' },
        source: source(['b']),
        flattenedIds,
        elementDataMap,
        collapsedGroupIds: new Set()
      })
    ).toMatchObject({
      kind: 'valid',
      zone: 'before',
      request: {
        elementIds: ['b'],
        targetParentId: 'workspace',
        targetIndex: 0
      }
    })

    expect(
      projectLayerDropIntent({
        target: { kind: 'row', elementId: 'b', zone: 'after' },
        source: source(['a']),
        flattenedIds,
        elementDataMap,
        collapsedGroupIds: new Set()
      })
    ).toMatchObject({
      kind: 'valid',
      zone: 'after',
      request: {
        elementIds: ['a'],
        targetParentId: 'workspace',
        targetIndex: 1
      }
    })
  })

  it('keeps selected ids unchanged while indexing after all moved ids are removed', () => {
    expect(
      projectLayerDropIntent({
        target: { kind: 'row', elementId: 'group', zone: 'before' },
        source: source(['c', 'a']),
        flattenedIds,
        elementDataMap,
        collapsedGroupIds: new Set()
      })
    ).toMatchObject({
      kind: 'valid',
      request: {
        elementIds: ['c', 'a'],
        targetParentId: 'workspace',
        targetIndex: 1
      }
    })
  })

  it('appends inside an official Group and reveals a collapsed target after commit', () => {
    expect(
      projectLayerDropIntent({
        target: { kind: 'row', elementId: 'group', zone: 'inside' },
        source: source(['a']),
        flattenedIds,
        elementDataMap,
        collapsedGroupIds: new Set(['group'])
      })
    ).toEqual({
      kind: 'valid',
      zone: 'inside',
      targetElementId: 'group',
      expandGroupId: 'group',
      request: {
        elementIds: ['a'],
        targetParentId: 'group',
        targetIndex: 3
      }
    })
  })

  it('appends Group children to the canonical workspace root', () => {
    expect(
      projectLayerDropIntent({
        target: { kind: 'workspace' },
        source: source(['g1'], 'group'),
        flattenedIds,
        elementDataMap,
        collapsedGroupIds: new Set()
      })
    ).toMatchObject({
      kind: 'valid',
      zone: 'workspace',
      request: {
        elementIds: ['g1'],
        targetParentId: 'workspace',
        targetIndex: 6
      }
    })
  })

  it.each([
    {
      label: 'selected target',
      target: { kind: 'row', elementId: 'a', zone: 'before' } as const,
      moveSource: source(['a']),
      reason: 'selected-target'
    },
    {
      label: 'descendant target',
      target: { kind: 'row', elementId: 'nested', zone: 'inside' } as const,
      moveSource: source(['group']),
      reason: 'descendant-target'
    },
    {
      label: 'locked target',
      target: {
        kind: 'row',
        elementId: 'lockedGroup',
        zone: 'inside'
      } as const,
      moveSource: source(['a']),
      reason: 'locked-target'
    },
    {
      label: 'unsupported container',
      target: { kind: 'row', elementId: 'frame', zone: 'inside' } as const,
      moveSource: source(['a']),
      reason: 'unsupported-container'
    },
    {
      label: 'missing target',
      target: { kind: 'row', elementId: 'missing', zone: 'after' } as const,
      moveSource: source(['a']),
      reason: 'missing-target'
    }
  ])('projects one invalid state for $label', (scenario) => {
    expect(
      projectLayerDropIntent({
        target: scenario.target,
        source: scenario.moveSource,
        flattenedIds,
        elementDataMap,
        collapsedGroupIds: new Set()
      })
    ).toEqual({
      kind: 'invalid',
      zone: scenario.target.zone,
      targetElementId: scenario.target.elementId,
      reason: scenario.reason
    })
  })

  it('rejects inconsistent canonical roots instead of correcting a workspace index', () => {
    expect(
      projectLayerDropIntent({
        target: { kind: 'workspace' },
        source: source(['a']),
        flattenedIds,
        elementDataMap: {
          ...elementDataMap,
          c: element('c', 'other-workspace')
        },
        collapsedGroupIds: new Set()
      })
    ).toEqual({
      kind: 'invalid',
      zone: 'workspace',
      targetElementId: null,
      reason: 'invalid-workspace-root'
    })
  })
})
