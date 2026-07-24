import { describe, expect, it, vi } from 'vitest'
import type {
  ElementPropertyOwnerRelation,
  PropsRestorePlan,
  PropsRestoreSnapshot,
  SceneTreeRestorePlan,
  SceneTreeRestoreSnapshot
} from '@asyra/utils'
import { createSceneTreeAPIs } from '../apis/scene-tree'
import { createPropsAPIs } from '../apis/props'

describe('remote restore owner facades', () => {
  it('delegates Scene Tree plans only to the supplied owner requests', () => {
    const snapshot = {
      elementId: 'group-1',
      removed: [],
      rootParentChildrenAfter: []
    } as unknown as SceneTreeRestoreSnapshot
    const plan = Object.freeze({
      kind: 'scene-tree-restore-plan',
      elementId: 'group-1',
      entries: Object.freeze([]),
      propertyOwnerRelations: Object.freeze([])
    }) as SceneTreeRestorePlan
    const firstPreflight = vi.fn(() => plan)
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
      ) => SceneTreeRestorePlan
      applyRestoreSubtree: (input: SceneTreeRestorePlan) => unknown
    }
    createSceneTreeAPIs({
      ...requests,
      preflightRestoreSubtree: secondPreflight
    } as never)

    expect(first.preflightRestoreSubtree(snapshot)).toBe(plan)
    expect(first.applyRestoreSubtree(plan)).toEqual({
      elementId: 'group-1',
      removed: [],
      rootParentChildrenAfter: []
    })
    expect(firstPreflight).toHaveBeenCalledWith(snapshot)
    expect(firstApply).toHaveBeenCalledWith(plan, undefined)
    expect(secondPreflight).not.toHaveBeenCalled()
  })

  it('delegates Props plans only to the supplied owner requests', () => {
    const snapshot: PropsRestoreSnapshot = { components: [] }
    const relations: readonly ElementPropertyOwnerRelation[] = []
    const plan = Object.freeze({
      kind: 'props-restore-plan',
      entries: Object.freeze([]),
      ownerRelations: Object.freeze([])
    }) as PropsRestorePlan
    const firstPreflight = vi.fn(() => plan)
    const firstApply = vi.fn(() => Object.freeze([] as string[]))
    const secondPreflight = vi.fn()
    const requests = {
      updatePropertyById: () => undefined,
      commitPropertyChanges: () => undefined,
      propsLoadData: () => undefined,
      propsSaveData: () => ({}),
      preflightRestoreProperties: firstPreflight,
      applyRestoreProperties: firstApply
    }
    const first = createPropsAPIs(requests as never) as unknown as {
      preflightRestoreProperties: (
        input: PropsRestoreSnapshot,
        ownerRelations: readonly ElementPropertyOwnerRelation[]
      ) => PropsRestorePlan
      applyRestoreProperties: (input: PropsRestorePlan) => readonly string[]
    }
    createPropsAPIs({
      ...requests,
      preflightRestoreProperties: secondPreflight
    } as never)

    expect(first.preflightRestoreProperties(snapshot, relations)).toBe(plan)
    expect(first.applyRestoreProperties(plan)).toEqual([])
    expect(firstPreflight).toHaveBeenCalledWith(snapshot, relations)
    expect(firstApply).toHaveBeenCalledWith(plan, undefined)
    expect(secondPreflight).not.toHaveBeenCalled()
  })
})
