import { describe, expect, it } from 'vitest'
import { EntityTypes, type ElementRawData } from '@asyra/utils'
import { projectVisibleLayerRows } from '../layer-hierarchy'

const element = (
  id: string,
  parentId: string,
  type: string = EntityTypes.ELEMENT
): Partial<ElementRawData> => ({
  id,
  name: id,
  parentId,
  type,
  lock: false,
  visible: true
})

const elementDataMap = {
  root: element('root', 'workspace', EntityTypes.GROUP),
  child: element('child', 'root'),
  nested: element('nested', 'root', EntityTypes.GROUP),
  leaf: element('leaf', 'nested'),
  sibling: element('sibling', 'workspace')
}
const flattenedIds = ['root', 'child', 'nested', 'leaf', 'sibling']

describe('canonical Layers hierarchy projection', () => {
  it('preserves parent-before-descendant order and derives exact depth', () => {
    expect(
      projectVisibleLayerRows(flattenedIds, elementDataMap, new Set())
    ).toEqual({
      rows: [
        { id: 'root', depth: 0, isGroup: true, isExpanded: true },
        { id: 'child', depth: 1, isGroup: false, isExpanded: false },
        { id: 'nested', depth: 1, isGroup: true, isExpanded: true },
        { id: 'leaf', depth: 2, isGroup: false, isExpanded: false },
        { id: 'sibling', depth: 0, isGroup: false, isExpanded: false }
      ],
      error: null
    })
  })

  it('hides descendants of collapsed Groups without changing canonical order', () => {
    expect(
      projectVisibleLayerRows(flattenedIds, elementDataMap, new Set(['nested']))
    ).toEqual({
      rows: [
        { id: 'root', depth: 0, isGroup: true, isExpanded: true },
        { id: 'child', depth: 1, isGroup: false, isExpanded: false },
        { id: 'nested', depth: 1, isGroup: true, isExpanded: false },
        { id: 'sibling', depth: 0, isGroup: false, isExpanded: false }
      ],
      error: null
    })

    expect(
      projectVisibleLayerRows(
        flattenedIds,
        elementDataMap,
        new Set(['root'])
      ).rows.map((row) => row.id)
    ).toEqual(['root', 'sibling'])
  })

  it('projects restored normal and empty Groups from canonical stable identities', () => {
    const restoredMap = {
      restored: element('restored', 'workspace', EntityTypes.GROUP),
      child: element('child', 'restored'),
      empty: element('empty', 'workspace', EntityTypes.GROUP)
    }

    expect(
      projectVisibleLayerRows(
        ['restored', 'child', 'empty'],
        restoredMap,
        new Set()
      )
    ).toEqual({
      rows: [
        { id: 'restored', depth: 0, isGroup: true, isExpanded: true },
        { id: 'child', depth: 1, isGroup: false, isExpanded: false },
        { id: 'empty', depth: 0, isGroup: true, isExpanded: true }
      ],
      error: null
    })
  })

  it('rejects duplicate, missing, misordered, and cyclic projections', () => {
    expect(
      projectVisibleLayerRows(['root', 'root'], elementDataMap, new Set())
    ).toMatchObject({ rows: [], error: expect.stringMatching(/duplicate/i) })
    expect(
      projectVisibleLayerRows(['root', 'missing'], elementDataMap, new Set())
    ).toMatchObject({ rows: [], error: expect.stringMatching(/missing/i) })
    expect(
      projectVisibleLayerRows(['child', 'root'], elementDataMap, new Set())
    ).toMatchObject({ rows: [], error: expect.stringMatching(/before/i) })

    const cyclicMap = {
      root: element('root', 'child', EntityTypes.GROUP),
      child: element('child', 'root', EntityTypes.GROUP)
    }
    expect(
      projectVisibleLayerRows(['root', 'child'], cyclicMap, new Set())
    ).toMatchObject({ rows: [], error: expect.stringMatching(/cycle/i) })
  })
})
