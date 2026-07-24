import { afterEach, describe, expect, it, vi } from 'vitest'
import { EntityTypes, type ElementRawData } from '@asyra/utils'
import { hierarchyApis, selectionApis } from '../common-apis'
import {
  createCurrentGroupCommandRequest,
  createGroupCommandRequest,
  deriveGroupCommandState,
  getCurrentGroupCommandState
} from './group-commands'

const element = (
  id: string,
  parentId: string,
  type: string = EntityTypes.ELEMENT
): Partial<ElementRawData> => ({
  id,
  name: id,
  type,
  parentId,
  visible: true,
  lock: false
})

const flattenedIds = ['a', 'group-1', 'nested-child', 'b', 'c', 'other']
const elementDataMap = {
  a: element('a', 'workspace'),
  'group-1': element('group-1', 'workspace', EntityTypes.GROUP),
  'nested-child': element('nested-child', 'group-1'),
  b: element('b', 'workspace'),
  c: element('c', 'workspace'),
  other: element('other', 'other-parent')
}

describe('Group command eligibility and intent', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('accepts one, contiguous, non-contiguous, and nested sibling selections', () => {
    expect(
      deriveGroupCommandState(['a'], flattenedIds, elementDataMap)
    ).toMatchObject({
      canGroup: true,
      canUngroup: false,
      canonicalSelectedIds: ['a']
    })

    expect(
      deriveGroupCommandState(['c', 'a', 'b'], flattenedIds, elementDataMap)
    ).toMatchObject({
      canGroup: true,
      canonicalSelectedIds: ['a', 'b', 'c']
    })

    expect(
      deriveGroupCommandState(['c', 'group-1'], flattenedIds, elementDataMap)
    ).toMatchObject({
      canGroup: true,
      canonicalSelectedIds: ['group-1', 'c']
    })
  })

  it('rejects empty, duplicate, missing, workspace, and mixed-parent selection', () => {
    expect(
      deriveGroupCommandState([], flattenedIds, elementDataMap).canGroup
    ).toBe(false)
    expect(
      deriveGroupCommandState(['a', 'a'], flattenedIds, elementDataMap).canGroup
    ).toBe(false)
    expect(
      deriveGroupCommandState(['a', 'missing'], flattenedIds, elementDataMap)
        .canGroup
    ).toBe(false)
    expect(
      deriveGroupCommandState(['workspace'], flattenedIds, elementDataMap)
        .canGroup
    ).toBe(false)
    expect(
      deriveGroupCommandState(['a', 'other'], flattenedIds, elementDataMap)
        .canGroup
    ).toBe(false)
  })

  it('allows ungroup only for one projected official Group with a parent', () => {
    expect(
      deriveGroupCommandState(['group-1'], flattenedIds, elementDataMap)
        .canUngroup
    ).toBe(true)
    expect(
      deriveGroupCommandState(['a'], flattenedIds, elementDataMap).canUngroup
    ).toBe(false)
    expect(
      deriveGroupCommandState(['group-1', 'c'], flattenedIds, elementDataMap)
        .canUngroup
    ).toBe(false)
    expect(
      deriveGroupCommandState(['missing'], flattenedIds, elementDataMap)
        .canUngroup
    ).toBe(false)
  })

  it('emits one canonical ID-only request and bypasses unavailable commands', () => {
    const state = deriveGroupCommandState(
      ['c', 'a'],
      flattenedIds,
      elementDataMap
    )

    expect(createGroupCommandRequest('group', state)).toEqual({
      command: 'group',
      elementIds: ['a', 'c']
    })
    expect(createGroupCommandRequest('ungroup', state)).toBeNull()

    const ungroupState = deriveGroupCommandState(
      ['group-1'],
      flattenedIds,
      elementDataMap
    )
    expect(createGroupCommandRequest('ungroup', ungroupState)).toEqual({
      command: 'ungroup',
      elementIds: ['group-1']
    })
  })

  it('derives the current request only through app common-API projection reads', () => {
    vi.spyOn(selectionApis, 'getSelectedIds').mockReturnValue(['c', 'a'])
    vi.spyOn(hierarchyApis, 'getFlattenedElementIds').mockReturnValue(
      flattenedIds
    )
    vi.spyOn(hierarchyApis, 'getElementDataMap').mockReturnValue(elementDataMap)

    expect(getCurrentGroupCommandState()).toMatchObject({
      canGroup: true,
      canUngroup: false,
      canonicalSelectedIds: ['a', 'c']
    })
    expect(createCurrentGroupCommandRequest('group')).toEqual({
      command: 'group',
      elementIds: ['a', 'c']
    })
    expect(selectionApis.getSelectedIds).toHaveBeenCalledTimes(2)
    expect(hierarchyApis.getFlattenedElementIds).toHaveBeenCalledTimes(2)
    expect(hierarchyApis.getElementDataMap).toHaveBeenCalledTimes(2)
  })
})
