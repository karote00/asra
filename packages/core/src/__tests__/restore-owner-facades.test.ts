import { describe, expect, it, vi } from 'vitest'
import type {
  ElementPropertyRelation,
  PreparedPropsRestore,
  PropsRestoreSnapshot,
  PreparedSceneTreeRestore,
  SceneTreeRestoreSnapshot
} from '@asyra/utils'
import { createSceneTreeAPIs } from '../apis/scene-tree'
import { createPropsAPIs } from '../apis/props'

describe('remote restore owner facades', () => {
  it('delegates prepared Scene Tree restores only to the supplied owner requests', () => {
    const snapshot = {
      elementId: 'group-1',
      removed: [],
      rootParentChildrenAfter: []
    } as unknown as SceneTreeRestoreSnapshot
    const prepared = Object.freeze({
      kind: 'prepared-scene-tree-restore',
      elementId: 'group-1',
      entries: Object.freeze([]),
      propertyOwnerRelations: Object.freeze([])
    }) as PreparedSceneTreeRestore
    const firstPreflight = vi.fn(() => prepared)
    const firstApply = vi.fn(() => ({
      elementId: 'group-1',
      removed: [],
      rootParentChildrenAfter: []
    }))
    const secondPreflight = vi.fn()
    const requests = {
      sceneTreeSaveData: () => ({
        workspace: '',
        workspaceList: [],
        elements: {}
      }),
      getElementComputedData: () => undefined,
      moveElements: () => ({ elementIds: [], moves: [] }),
      removeSubtree: () => ({
        elementId: 'group-1',
        removed: [],
        rootParentChildrenAfter: []
      }),
      preflightRestoreSubtree: firstPreflight,
      applyRestoreSubtree: firstApply,
      refreshComputedDataFromProperty: () => undefined,
      getAllElementsBounds: () => null,
      isContainerType: () => false
    }
    const first = createSceneTreeAPIs(requests as never) as unknown as {
      preflightRestoreSubtree: (
        input: SceneTreeRestoreSnapshot
      ) => PreparedSceneTreeRestore
      applyRestoreSubtree: (input: PreparedSceneTreeRestore) => unknown
    }
    createSceneTreeAPIs({
      ...requests,
      preflightRestoreSubtree: secondPreflight
    } as never)

    expect(first.preflightRestoreSubtree(snapshot)).toBe(prepared)
    expect(first.applyRestoreSubtree(prepared)).toEqual({
      elementId: 'group-1',
      removed: [],
      rootParentChildrenAfter: []
    })
    expect(firstPreflight).toHaveBeenCalledWith(snapshot)
    expect(firstApply).toHaveBeenCalledWith(prepared, undefined)
    expect(secondPreflight).not.toHaveBeenCalled()
  })

  it('delegates prepared Props restores only to the supplied owner requests', () => {
    const snapshot: PropsRestoreSnapshot = { components: [] }
    const relations: readonly ElementPropertyRelation[] = []
    const prepared = Object.freeze({
      kind: 'prepared-props-restore',
      entries: Object.freeze([]),
      ownerRelations: Object.freeze([])
    }) as PreparedPropsRestore
    const firstPreflight = vi.fn(() => prepared)
    const firstApply = vi.fn(() => Object.freeze([] as string[]))
    const secondPreflight = vi.fn()
    const requests = {
      propsLoadData: () => undefined,
      propsSaveData: () => ({}),
      preflightRestoreProperties: firstPreflight,
      applyRestoreProperties: firstApply
    }
    const first = createPropsAPIs(requests as never) as unknown as {
      preflightRestoreProperties: (
        input: PropsRestoreSnapshot,
        ownerRelations: readonly ElementPropertyRelation[]
      ) => PreparedPropsRestore
      applyRestoreProperties: (input: PreparedPropsRestore) => readonly string[]
    }
    createPropsAPIs({
      ...requests,
      preflightRestoreProperties: secondPreflight
    } as never)

    expect(first.preflightRestoreProperties(snapshot, relations)).toBe(prepared)
    expect(first.applyRestoreProperties(prepared)).toEqual([])
    expect(firstPreflight).toHaveBeenCalledWith(snapshot, relations)
    expect(firstApply).toHaveBeenCalledWith(prepared, undefined)
    expect(secondPreflight).not.toHaveBeenCalled()
  })
})
