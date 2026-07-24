import { EntityTypes, type ElementRawData } from '@asyra/utils'
import { describe, expect, it } from 'vitest'
import { deriveLayerMoveSource } from './layer-move-source'

const element = (
  id: string,
  parentId: string,
  overrides: Partial<ElementRawData> = {}
): Partial<ElementRawData> => ({
  id,
  name: id,
  type: EntityTypes.ELEMENT,
  parentId,
  lock: false,
  visible: true,
  ...overrides
})

const elementDataMap = {
  workspace: element('workspace', '', { type: EntityTypes.WORKSPACE }),
  a: element('a', 'workspace'),
  b: element('b', 'workspace'),
  c: element('c', 'group-1'),
  locked: element('locked', 'workspace', { lock: true }),
  'group-1': element('group-1', 'workspace', { type: EntityTypes.GROUP })
}
const flattenedIds = ['a', 'b', 'group-1', 'c', 'locked']

describe('Layers hierarchy move source intent', () => {
  it('replaces selection when pointer-down begins on an unselected row', () => {
    expect(
      deriveLayerMoveSource({
        sourceElementId: 'b',
        selectedIds: ['a'],
        flattenedIds,
        elementDataMap
      })
    ).toEqual({
      ok: true,
      plan: {
        elementIds: ['b'],
        sourceParentId: 'workspace',
        preSessionSelection: ['a'],
        requestedSourceSelection: ['b'],
        replacesSelection: true
      }
    })
  })

  it('retains the complete selected sibling ids without app ordering', () => {
    expect(
      deriveLayerMoveSource({
        sourceElementId: 'b',
        selectedIds: ['b', 'a'],
        flattenedIds,
        elementDataMap
      })
    ).toEqual({
      ok: true,
      plan: {
        elementIds: ['b', 'a'],
        sourceParentId: 'workspace',
        preSessionSelection: ['b', 'a'],
        requestedSourceSelection: ['b', 'a'],
        replacesSelection: false
      }
    })
  })

  it.each([
    {
      label: 'workspace source',
      sourceElementId: 'workspace',
      selectedIds: ['workspace'],
      reason: 'workspace-source'
    },
    {
      label: 'locked source',
      sourceElementId: 'locked',
      selectedIds: ['locked'],
      reason: 'locked-source'
    },
    {
      label: 'missing id',
      sourceElementId: 'missing',
      selectedIds: ['missing'],
      reason: 'missing-source'
    },
    {
      label: 'duplicate id',
      sourceElementId: 'a',
      selectedIds: ['a', 'a'],
      reason: 'duplicate-source'
    },
    {
      label: 'mixed parent',
      sourceElementId: 'a',
      selectedIds: ['a', 'c'],
      reason: 'mixed-parent-source'
    }
  ])('rejects the complete $label candidate', (scenario) => {
    const result = deriveLayerMoveSource({
      sourceElementId: scenario.sourceElementId,
      selectedIds: scenario.selectedIds,
      flattenedIds,
      elementDataMap
    })

    expect(result).toEqual({ ok: false, reason: scenario.reason })
    expect('plan' in result).toBe(false)
  })

  it('rejects a stale projection even when element data remains present', () => {
    expect(
      deriveLayerMoveSource({
        sourceElementId: 'a',
        selectedIds: ['a', 'b'],
        flattenedIds: flattenedIds.filter((id) => id !== 'b'),
        elementDataMap
      })
    ).toEqual({ ok: false, reason: 'stale-source-projection' })
  })
})
