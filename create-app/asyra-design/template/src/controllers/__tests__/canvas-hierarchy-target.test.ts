import { EntityTypes, type ElementRawData } from '@asyra/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { elementApis, hierarchyApis, selectionApis } from '../../common-apis'
import {
  resolveCanvasHoverHierarchyTarget,
  resolveCanvasHoverHierarchyTargetAtClientPos,
  resolveCreateElementParent,
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

const resolveCreateParent = (
  hitElementId: string | null,
  selectedElementIds: readonly string[] = [],
  bypassParentScope = false,
  overrides: {
    flattenedIds?: readonly string[]
    elementDataMap?: Record<string, ProjectedElement>
  } = {}
) =>
  resolveCreateElementParent({
    hitElementId,
    selectedElementIds,
    bypassParentScope,
    workspaceId: 'workspace',
    flattenedIds: overrides.flattenedIds ?? flattenedIds,
    elementDataMap: overrides.elementDataMap ?? elementDataMap
  })

const resolveHover = (
  hitElementId: string | null,
  groupBoundsHitElementIds: readonly string[],
  selectedElementIds: readonly string[] = [],
  bypassParentScope = false,
  overrides: {
    flattenedIds?: readonly string[]
    elementDataMap?: Record<string, ProjectedElement>
  } = {}
) =>
  resolveCanvasHoverHierarchyTarget({
    hitElementId,
    groupBoundsHitElementIds,
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

  it('uses a canonical Group bounds candidate only when the raw Render hit is missing', () => {
    expect(resolveHover(null, ['group-2'])).toBe('group-1')
    expect(resolveHover(null, ['group-2'], ['rect-2a'])).toBe('group-2')
    expect(resolveHover(null, ['group-3'], ['rect-2a'])).toBeNull()
    expect(resolveHover('outside', ['group-2'])).toBe('outside')
  })

  it('bypasses Group bounds candidates for modifiers and rejects invalid candidates', () => {
    expect(resolveHover(null, ['group-2'], [], true)).toBeNull()
    expect(resolveHover(null, ['rect-2a'])).toBeNull()
    expect(resolveHover(null, ['missing'])).toBeNull()
  })

  it('queries official Group bounds in reverse canonical order only after a missing raw hit', () => {
    vi.spyOn(hierarchyApis, 'getFlattenedElementIds').mockReturnValue(
      flattenedIds
    )
    vi.spyOn(hierarchyApis, 'getElementDataMap').mockReturnValue(elementDataMap)
    vi.spyOn(selectionApis, 'getSelectedIds').mockReturnValue([])
    vi.spyOn(elementApis, 'getRenderElementIdAtClientPos').mockReturnValue(null)
    vi.spyOn(
      elementApis,
      'isClientPositionInsideElementBounds'
    ).mockImplementation((elementId) => elementId === 'group-2')

    expect(
      resolveCanvasHoverHierarchyTargetAtClientPos({
        mousePosition: { x: 10, y: 20 },
        keyMeta: false,
        keyCtrl: false
      } as never)
    ).toBe('group-1')
    expect(
      elementApis.isClientPositionInsideElementBounds
    ).toHaveBeenNthCalledWith(1, 'group-3', { x: 10, y: 20 })
    expect(
      elementApis.isClientPositionInsideElementBounds
    ).toHaveBeenNthCalledWith(2, 'nested', { x: 10, y: 20 })
    expect(
      elementApis.isClientPositionInsideElementBounds
    ).toHaveBeenNthCalledWith(3, 'group-2', { x: 10, y: 20 })
  })

  it('does not query Group bounds when a visible raw Render hit exists', () => {
    vi.spyOn(hierarchyApis, 'getFlattenedElementIds').mockReturnValue(
      flattenedIds
    )
    vi.spyOn(hierarchyApis, 'getElementDataMap').mockReturnValue(elementDataMap)
    vi.spyOn(selectionApis, 'getSelectedIds').mockReturnValue([])
    vi.spyOn(elementApis, 'getRenderElementIdAtClientPos').mockReturnValue(
      'outside'
    )
    vi.spyOn(elementApis, 'isClientPositionInsideElementBounds')

    expect(
      resolveCanvasHoverHierarchyTargetAtClientPos({
        mousePosition: { x: 10, y: 20 },
        keyMeta: false,
        keyCtrl: false
      } as never)
    ).toBe('outside')
    expect(
      elementApis.isClientPositionInsideElementBounds
    ).not.toHaveBeenCalled()
  })

  it('derives one explicit Group or workspace create parent from the same target rules', () => {
    expect(resolveCreateParent('nested-leaf')).toBe('group-1')
    expect(resolveCreateParent('rect-2b', ['rect-2a'])).toBe('group-2')
    expect(resolveCreateParent('nested-leaf', ['rect-2a'])).toBe('nested')
    expect(resolveCreateParent('nested-leaf', ['rect-2a'], true)).toBe('nested')
    expect(resolveCreateParent('outside')).toBe('workspace')
    expect(resolveCreateParent(null, ['rect-2a'])).toBe('workspace')
    expect(
      resolveCreateParent(null, [], false, {
        flattenedIds: [],
        elementDataMap: {}
      })
    ).toBe('workspace')
  })

  it('does not produce a create parent from a rejected or malformed hierarchy target', () => {
    expect(resolveCreateParent('rect-3a', ['rect-2a'])).toBeNull()
    expect(resolveCreateParent('group-2', ['rect-2a'], true)).toBeNull()
    expect(
      resolveCreateParent('nested-leaf', [], false, {
        elementDataMap: {
          ...elementDataMap,
          'group-1': element('group-1', 'nested-leaf', EntityTypes.GROUP)
        }
      })
    ).toBeNull()
  })
})
