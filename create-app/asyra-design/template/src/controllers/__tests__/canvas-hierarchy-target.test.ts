import { EntityTypes, type ElementRawData } from '@asyra/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { elementApis, hierarchyApis, selectionApis } from '../../common-apis'
import {
  resolveCanvasHierarchyTarget,
  resolveCanvasHierarchyTargetAtClientPos,
  resolveCurrentCanvasHierarchyTarget
} from '../canvas-hierarchy-target'

type ProjectedElement = Partial<ElementRawData>

const element = (
  id: string,
  parentId: string,
  type: string = EntityTypes.ELEMENT
): ProjectedElement => ({
  id,
  name: id,
  type,
  parentId,
  lock: false,
  visible: true
})

const flattenedIds = [
  'group-1',
  'group-2',
  'rect-2a',
  'rect-2b',
  'nested',
  'nested-leaf',
  'group-3',
  'rect-3a',
  'rect-3b',
  'outside'
]

const elementDataMap: Record<string, ProjectedElement> = {
  'group-1': element('group-1', 'workspace', EntityTypes.GROUP),
  'group-2': element('group-2', 'group-1', EntityTypes.GROUP),
  'rect-2a': element('rect-2a', 'group-2'),
  'rect-2b': element('rect-2b', 'group-2'),
  nested: element('nested', 'group-2', EntityTypes.GROUP),
  'nested-leaf': element('nested-leaf', 'nested'),
  'group-3': element('group-3', 'group-1', EntityTypes.GROUP),
  'rect-3a': element('rect-3a', 'group-3'),
  'rect-3b': element('rect-3b', 'group-3'),
  outside: element('outside', 'workspace')
}

const resolve = (
  hitElementId: string | null,
  selectedElementIds: readonly string[] = [],
  bypassParentScope = false,
  overrides: {
    flattenedIds?: readonly string[]
    elementDataMap?: Record<string, ProjectedElement>
  } = {}
) =>
  resolveCanvasHierarchyTarget({
    hitElementId,
    selectedElementIds,
    bypassParentScope,
    flattenedIds: overrides.flattenedIds ?? flattenedIds,
    elementDataMap: overrides.elementDataMap ?? elementDataMap
  })

describe('canvas hierarchy target resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves a nested raw hit to the workspace direct child without selection', () => {
    expect(resolve('nested-leaf')).toBe('group-1')
    expect(resolve('outside')).toBe('outside')
  })

  it('resolves only within the exact selected parent scope', () => {
    expect(resolve('rect-2b', ['rect-2a'])).toBe('rect-2b')
    expect(resolve('nested-leaf', ['rect-2a'])).toBe('nested')
    expect(resolve('rect-3a', ['rect-2a'])).toBeNull()
  })

  it('uses every selected parent scope and picks the nearest matching ancestor', () => {
    const selection = ['rect-2a', 'rect-3a']

    expect(resolve('nested-leaf', selection)).toBe('nested')
    expect(resolve('rect-3b', selection)).toBe('rect-3b')
  })

  it('bypasses parent scopes only for an existing non-Group raw hit', () => {
    expect(resolve('nested-leaf', ['rect-2a'], true)).toBe('nested-leaf')
    expect(resolve('group-2', ['rect-2a'], true)).toBeNull()
    expect(resolve('missing', ['rect-2a'], true)).toBeNull()
  })

  it('rejects duplicate or missing selected identities', () => {
    expect(resolve('rect-2b', ['rect-2a', 'rect-2a'])).toBeNull()
    expect(resolve('rect-2b', ['missing'])).toBeNull()
  })

  it('fails closed for a missing raw hit', () => {
    expect(resolve(null)).toBeNull()
    expect(resolve('missing')).toBeNull()
  })

  it('fails closed for duplicate, stale, cyclic, and invalid-root projections', () => {
    expect(
      resolve('nested-leaf', [], false, {
        flattenedIds: [...flattenedIds, 'nested-leaf']
      })
    ).toBeNull()

    expect(
      resolve('nested-leaf', [], false, {
        elementDataMap: {
          ...elementDataMap,
          stale: element('stale', 'workspace')
        }
      })
    ).toBeNull()

    expect(
      resolve('nested-leaf', [], false, {
        elementDataMap: {
          ...elementDataMap,
          'group-1': element('group-1', 'nested-leaf', EntityTypes.GROUP)
        }
      })
    ).toBeNull()

    expect(
      resolve('nested-leaf', [], false, {
        elementDataMap: {
          ...elementDataMap,
          outside: element('outside', 'other-workspace')
        }
      })
    ).toBeNull()
  })

  it('reads the current canonical projection and selection through app common APIs', () => {
    vi.spyOn(hierarchyApis, 'getFlattenedElementIds').mockReturnValue(
      flattenedIds
    )
    vi.spyOn(hierarchyApis, 'getElementDataMap').mockReturnValue(elementDataMap)
    vi.spyOn(selectionApis, 'getSelectedIds').mockReturnValue(['rect-2a'])

    expect(
      resolveCurrentCanvasHierarchyTarget('rect-2b', {
        keyMeta: false,
        keyCtrl: false
      } as never)
    ).toBe('rect-2b')
    expect(hierarchyApis.getFlattenedElementIds).toHaveBeenCalledOnce()
    expect(hierarchyApis.getElementDataMap).toHaveBeenCalledOnce()
    expect(selectionApis.getSelectedIds).toHaveBeenCalledOnce()
  })

  it('maps Ctrl to the same parent-scope bypass as Meta', () => {
    vi.spyOn(hierarchyApis, 'getFlattenedElementIds').mockReturnValue(
      flattenedIds
    )
    vi.spyOn(hierarchyApis, 'getElementDataMap').mockReturnValue(elementDataMap)
    vi.spyOn(selectionApis, 'getSelectedIds').mockReturnValue(['rect-2a'])

    expect(
      resolveCurrentCanvasHierarchyTarget('rect-3a', {
        keyMeta: false,
        keyCtrl: true
      } as never)
    ).toBe('rect-3a')
  })

  it('uses only the Render hit query for client-position resolution', () => {
    vi.spyOn(hierarchyApis, 'getFlattenedElementIds').mockReturnValue(
      flattenedIds
    )
    vi.spyOn(hierarchyApis, 'getElementDataMap').mockReturnValue(elementDataMap)
    vi.spyOn(selectionApis, 'getSelectedIds').mockReturnValue([])
    vi.spyOn(elementApis, 'getRenderElementIdAtClientPos').mockReturnValue(
      'nested-leaf'
    )
    vi.spyOn(elementApis, 'getElementIdAtClientPos')

    expect(
      resolveCanvasHierarchyTargetAtClientPos({
        mousePosition: { x: 10, y: 20 },
        keyMeta: false,
        keyCtrl: false
      } as never)
    ).toBe('group-1')
    expect(elementApis.getRenderElementIdAtClientPos).toHaveBeenCalledWith({
      x: 10,
      y: 20
    })
    expect(elementApis.getElementIdAtClientPos).not.toHaveBeenCalled()
  })
})
