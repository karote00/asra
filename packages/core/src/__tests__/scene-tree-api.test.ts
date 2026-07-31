import { describe, expect, it, vi } from 'vitest'
import type { CanonicalElementRemoval } from '@asyra/scene-tree'
import { subscribeToAddElement } from '@asyra/reactive-events'
import type {
  ComputedDataPatch,
  CreateElementData,
  DataTypes,
  ElementRawData,
  PropertyComponentRawData
} from '@asyra/utils'
import { createSceneTreeAPIs, type SceneTreeRequests } from '../apis/scene-tree'

interface LocalComputedDataEntry {
  readonly elementId: string
  readonly values: Readonly<Record<string, DataTypes>>
}

interface LocalComputedDataPatchEntry {
  readonly elementId: string
  readonly patch: ComputedDataPatch
}

const createRequests = () =>
  ({
    sceneTreeSaveData: () => ({
      workspace: '',
      workspaceList: [],
      elements: {}
    }),
    getCurrentWorkspaceId: vi.fn(() => 'workspace-1'),
    getElementComputedData: vi.fn<SceneTreeRequests['getElementComputedData']>(
      () => undefined
    ),
    updateLocalComputedData:
      vi.fn<SceneTreeRequests['updateLocalComputedData']>(),
    patchLocalComputedData:
      vi.fn<SceneTreeRequests['patchLocalComputedData']>(),
    projectLocalComputedDataFromPropertyIds:
      vi.fn<SceneTreeRequests['projectLocalComputedDataFromPropertyIds']>(),
    moveElements: vi.fn(() => ({ elementIds: [], moves: [] })),
    applyHierarchyMoves: vi.fn(() => true),
    applyElementDataChanges: vi.fn<
      SceneTreeRequests['applyElementDataChanges']
    >((changes) => Object.freeze(changes.map(({ id }) => id))),
    removeSubtree: vi.fn((elementId: string) => ({
      elementId,
      removed: [],
      rootParentChildrenAfter: []
    })),
    removeSubtreeFromCanonicalData: vi.fn((change) => ({
      elementId: change.elementId,
      removed: change.removed,
      rootParentChildrenAfter: change.rootParentChildrenAfter
    })),
    removeElementsFromCanonicalData: vi.fn(
      (removals: readonly CanonicalElementRemoval[]) =>
        Object.freeze(removals.map(({ data }) => data.id))
    ),
    preflightRestoreSubtree: vi.fn(),
    applyRestoreSubtree: vi.fn(),
    createElementsInParent: vi.fn((data: readonly CreateElementData[]) =>
      Object.freeze(data.map(({ id }, index) => id ?? `element-${index}`))
    ),
    createElementsInParentFromCanonicalData: vi.fn(
      (data: readonly ElementRawData[]) =>
        Object.freeze(data.map(({ id }) => id))
    ),
    getAllElementsBounds: () => null,
    isContainerType: () => false
  }) satisfies SceneTreeRequests

describe('createSceneTreeAPIs hierarchy facade', () => {
  it('delegates one and many descriptors through the only plural owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const addSubscriber = vi.fn()
    const subscription = subscribeToAddElement(addSubscriber)
    addSubscriber.mockClear()
    const options = { sharedDelivery: 'immediate' as const }

    expect(
      apis.createElementInParent(
        { id: 'single-element', type: 'rect', x: 1, y: 2 },
        'workspace-1',
        2,
        options
      )
    ).toBe('single-element')
    expect(
      apis.createElementsInParent(
        [
          { id: 'many-a', type: 'rect', x: 3, y: 4 },
          { id: 'many-b', type: 'rect', x: 5, y: 6 }
        ],
        'workspace-1',
        3,
        options
      )
    ).toEqual(['many-a', 'many-b'])

    expect(requests.createElementsInParent).toHaveBeenCalledTimes(2)
    expect(requests.createElementsInParent).toHaveBeenNthCalledWith(
      1,
      [expect.objectContaining({ id: 'single-element', type: 'rect' })],
      'workspace-1',
      2,
      options
    )
    expect(requests.createElementsInParent).toHaveBeenNthCalledWith(
      2,
      [
        expect.objectContaining({ id: 'many-a', type: 'rect' }),
        expect.objectContaining({ id: 'many-b', type: 'rect' })
      ],
      'workspace-1',
      3,
      options
    )
    expect(addSubscriber).not.toHaveBeenCalled()
    subscription.unsubscribe()
  })

  it('uses the current workspace for the parent-optional scalar convenience', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)

    expect(
      apis.createElement(
        { id: 'workspace-child', type: 'rect', x: 1, y: 2 },
        undefined,
        undefined,
        { undoable: false }
      )
    ).toBe('workspace-child')

    expect(requests.getCurrentWorkspaceId).toHaveBeenCalledOnce()
    expect(requests.createElementsInParent).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'workspace-child' })],
      'workspace-1',
      undefined,
      { undoable: false }
    )
  })

  it('rejects a scalar owner result that is not exactly one id', () => {
    const requests = createRequests()
    vi.mocked(requests.createElementsInParent).mockReturnValueOnce(
      Object.freeze([])
    )
    const apis = createSceneTreeAPIs(requests)

    expect(() =>
      apis.createElementInParent(
        { id: 'missing-result', type: 'rect', x: 0, y: 0 },
        'workspace-1'
      )
    ).toThrow(/exactly one ordered element id/i)
  })

  it('returns an isolated frozen ordered-id array and keeps empty plural input inert', () => {
    const requests = createRequests()
    const ownerResult = ['first', 'second']
    vi.mocked(requests.createElementsInParent).mockReturnValueOnce(ownerResult)
    const apis = createSceneTreeAPIs(requests)

    const result = apis.createElementsInParent(
      [
        { id: 'first', type: 'rect', x: 0, y: 0 },
        { id: 'second', type: 'rect', x: 0, y: 0 }
      ],
      'workspace-1'
    )
    ownerResult[0] = 'mutated'

    expect(result).toEqual(['first', 'second'])
    expect(Object.isFrozen(result)).toBe(true)
    expect(apis.createElementsInParent([], 'missing-parent')).toEqual([])
    expect(requests.createElementsInParent).toHaveBeenCalledOnce()
  })

  it('delegates detached canonical creation without an active-property variant', () => {
    const elements = [
      {
        id: 'canonical-rect',
        type: 'rect',
        name: 'Canonical Rectangle',
        parentId: 'workspace-1',
        visible: true,
        lock: false,
        props: {
          position: 'canonical-position',
          dimension: 'canonical-dimension'
        }
      }
    ] satisfies readonly ElementRawData[]
    const properties = [
      {
        id: 'canonical-position',
        type: 'position',
        x: 10,
        y: 20,
        xUnit: 'px',
        yUnit: 'px'
      },
      {
        id: 'canonical-dimension',
        type: 'dimension',
        width: 30,
        height: 40,
        widthUnit: 'px',
        heightUnit: 'px'
      }
    ] as unknown as readonly PropertyComponentRawData[]
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)

    const result = apis.createElementsInParentFromCanonicalData(
      elements,
      properties,
      'workspace-1',
      4,
      { sharedDelivery: 'immediate' }
    )

    expect(result).toEqual(['canonical-rect'])
    expect(Object.isFrozen(result)).toBe(true)
    expect(
      requests.createElementsInParentFromCanonicalData
    ).toHaveBeenCalledWith(elements, properties, 'workspace-1', 4, {
      sharedDelivery: 'immediate'
    })
  })

  it('keeps empty detached creation inert and rejects orphan properties', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const orphanProperty = {
      id: 'orphan-position',
      type: 'position'
    } as PropertyComponentRawData
    const emptyResult = apis.createElementsInParentFromCanonicalData(
      [],
      [],
      'missing-parent'
    )

    expect(emptyResult).toEqual([])
    expect(Object.isFrozen(emptyResult)).toBe(true)
    expect(
      requests.createElementsInParentFromCanonicalData
    ).not.toHaveBeenCalled()
    expect(() =>
      apis.createElementsInParentFromCanonicalData(
        [],
        [orphanProperty],
        'missing-parent'
      )
    ).toThrow(/orphan propert/i)
  })

  it('delegates origin-neutral exact removal and returns frozen ordered ids', () => {
    const removals = [
      {
        data: {
          id: 'element-1',
          type: 'rect',
          name: 'Element 1',
          parentId: 'group-1',
          visible: true,
          lock: false,
          props: {
            position: 'element-1-position',
            dimension: 'element-1-dimension'
          }
        },
        parentId: 'group-1',
        index: 0
      }
    ] satisfies readonly CanonicalElementRemoval[]
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)

    const result = apis.removeElementsFromCanonicalData(removals, {
      rollbackable: false
    })

    expect(result).toEqual(['element-1'])
    expect(Object.isFrozen(result)).toBe(true)
    expect(requests.removeElementsFromCanonicalData).toHaveBeenCalledWith(
      removals,
      { rollbackable: false }
    )
  })

  it('returns a detached computed-data snapshot through the ID facade', () => {
    const source = {
      x: 10,
      y: 20,
      fills: [{ color: '#ffffff' }]
    }
    const requests = createRequests()
    vi.mocked(requests.getElementComputedData).mockReturnValue(source)
    const apis = createSceneTreeAPIs(requests)

    const snapshot = apis.getElementComputedData('element-1')

    expect(requests.getElementComputedData).toHaveBeenCalledWith('element-1')
    expect(snapshot).toEqual(source)
    expect(snapshot).not.toBe(source)
    expect(snapshot?.fills).not.toBe(source.fills)
  })

  it('reprojects one ordered property-id batch and keeps empty input inert', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)

    apis.projectLocalComputedDataFromPropertyIds([
      'vector-root-b',
      'vector-root-a'
    ])
    apis.projectLocalComputedDataFromPropertyIds([])

    expect(
      requests.projectLocalComputedDataFromPropertyIds
    ).toHaveBeenCalledOnce()
    expect(
      requests.projectLocalComputedDataFromPropertyIds
    ).toHaveBeenCalledWith(['vector-root-b', 'vector-root-a'])
  })

  it('delegates hierarchy move and full subtree removal options unchanged', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const move = {
      elementIds: ['element-2', 'element-1'],
      targetParentId: 'group-1',
      targetIndex: 0
    }

    apis.moveElements(move, { undoable: false })
    apis.removeSubtree('group-1', { rollbackable: false })

    expect(requests.moveElements).toHaveBeenCalledWith(move, {
      undoable: false
    })
    expect(requests.removeSubtree).toHaveBeenCalledWith('group-1', {
      rollbackable: false
    })
  })
})

describe('createSceneTreeAPIs local computed facade', () => {
  it('delegates ordered value and patch batches directly to Scene requests', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const updates = Object.freeze([
      Object.freeze({
        elementId: 'element-1',
        values: Object.freeze({ x: 120, y: 240 })
      }),
      Object.freeze({
        elementId: 'element-2',
        values: Object.freeze({ width: 320 })
      })
    ]) satisfies readonly LocalComputedDataEntry[]
    const patches = Object.freeze([
      Object.freeze({
        elementId: 'element-1',
        patch: Object.freeze({
          values: Object.freeze({ x: 160 }),
          records: Object.freeze({
            points: Object.freeze({
              set: Object.freeze({
                'point-1': Object.freeze({ x: 160, y: 240 })
              })
            })
          })
        })
      })
    ]) satisfies readonly LocalComputedDataPatchEntry[]

    apis.updateLocalComputedData(updates)
    apis.patchLocalComputedData(patches)

    expect(requests.updateLocalComputedData).toHaveBeenCalledOnce()
    expect(requests.updateLocalComputedData.mock.calls[0]).toEqual([updates])
    expect(requests.updateLocalComputedData.mock.calls[0]?.[0]).toBe(updates)
    expect(requests.patchLocalComputedData).toHaveBeenCalledOnce()
    expect(requests.patchLocalComputedData.mock.calls[0]).toEqual([patches])
    expect(requests.patchLocalComputedData.mock.calls[0]?.[0]).toBe(patches)
  })

  it('keeps empty local computed batches inert', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)

    apis.updateLocalComputedData([])
    apis.patchLocalComputedData([])

    expect(requests.updateLocalComputedData).not.toHaveBeenCalled()
    expect(requests.patchLocalComputedData).not.toHaveBeenCalled()
  })
})
