import { describe, expect, it, vi } from 'vitest'
import type { FactoryMutationBatchDeliveryHandle } from '@asyra/factory'
import type { CanonicalElementRemoval } from '@asyra/scene-tree'
import {
  EventTypes,
  subscribeToAddElement,
  subscribeToChangeComputedData,
  subscribeToChangeComputedDataBatch
} from '@asyra/reactive-events'
import type {
  CreateElementData,
  ElementRawData,
  PropertyComponentRawData
} from '@asyra/utils'
import type {
  CanonicalElementBatchResult,
  CanonicalElementBatchTimingArtifact,
  CoreExtensionAPIs
} from '../index'
import { createSceneTreeAPIs, type SceneTreeRequests } from '../apis/scene-tree'

interface CanonicalElementBatchRequestContract {
  createElementsInParentBatch: (
    data: readonly CreateElementData[],
    parentId: string,
    index?: number,
    options?: unknown
  ) => CanonicalElementBatchResult
}

interface CanonicalElementBatchFacadeContract {
  createElementsInParentBatch: CanonicalElementBatchRequestContract['createElementsInParentBatch']
}

type CanonicalBatchExtensionContract = Pick<
  CoreExtensionAPIs,
  'createElementsInParentBatch'
>

type LegacyBatchExtensionContract = Pick<
  CoreExtensionAPIs,
  | 'createElementsInParent'
  | 'createElementsInParentFromCanonicalData'
  | 'createElementsInParentFromCanonicalDataUsingActiveProperties'
>

type RetainedLifecycleExtensionContract = Pick<
  CoreExtensionAPIs,
  | 'removeSubtreeUsingActiveProperties'
  | 'removeElementUsingActiveProperties'
  | 'removeElementsUsingActiveProperties'
>

const acceptBatchExtensionContract = (apis: LegacyBatchExtensionContract) =>
  apis

const acceptRetainedLifecycleExtensionContract = (
  apis: RetainedLifecycleExtensionContract
) => apis

const deliveryHandle: FactoryMutationBatchDeliveryHandle = {
  artifactId: 'factory-artifact-1',
  transactionId: 1,
  artifact: null,
  setDeliveryPlan: vi.fn(),
  deliverSlice: vi.fn()
}

const timing: CanonicalElementBatchTimingArtifact = Object.freeze({
  owner: '@asyra/core',
  clock: 'monotonic',
  startedAtMs: 10,
  completedAtMs: 12,
  durationMs: 2
})

const createRequests = (): SceneTreeRequests &
  CanonicalElementBatchRequestContract => ({
  sceneTreeSaveData: () => ({ workspace: '', workspaceList: [], elements: {} }),
  getElementComputedData: vi.fn(() => undefined),
  moveElements: vi.fn(() => ({ elementIds: [], moves: [] })),
  removeSubtree: vi.fn((elementId: string) => ({
    elementId,
    removed: [],
    rootParentChildrenAfter: []
  })),
  removeSubtreeUsingActiveProperties: vi.fn((elementId: string) => ({
    elementId,
    removed: [],
    rootParentChildrenAfter: []
  })),
  removeElementUsingActiveProperties: vi.fn(() => true),
  removeElementsUsingActiveProperties: vi.fn(
    (removals: readonly CanonicalElementRemoval[]) =>
      removals.map(({ data }) => data.id)
  ),
  preflightRestoreSubtree: vi.fn(),
  applyRestoreSubtree: vi.fn(),
  createElements: vi.fn((data: readonly CreateElementData[]) => ({
    orderedElementIds: data.map(({ id }, index) => id ?? `element-${index}`),
    deliveryHandle,
    timing
  })),
  createElementsInParentBatch: vi.fn((data: readonly CreateElementData[]) => ({
    orderedElementIds: data.map(({ id }, index) => id ?? `element-${index}`),
    deliveryHandle,
    timing
  })),
  createElementsInParent: vi.fn((data: readonly { id?: string }[]) =>
    data.map(({ id }, index) => id ?? `element-${index}`)
  ),
  createElementsInParentFromCanonicalData: vi.fn(
    (data: readonly { id: string }[]) => data.map(({ id }) => id)
  ),
  createElementsInParentFromCanonicalDataUsingActiveProperties: vi.fn(
    (data: readonly { id: string }[]) => data.map(({ id }) => id)
  ),
  refreshComputedDataFromProperty: () => undefined,
  getAllElementsBounds: () => null,
  isContainerType: () => false
})

describe('createSceneTreeAPIs hierarchy facade', () => {
  it('keeps every retained-property removal lifecycle API on the public Core extension contract', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const retainedApis = acceptRetainedLifecycleExtensionContract(apis)

    expect(retainedApis.removeSubtreeUsingActiveProperties).toBe(
      apis.removeSubtreeUsingActiveProperties
    )
    expect(retainedApis.removeElementUsingActiveProperties).toBe(
      apis.removeElementUsingActiveProperties
    )
    expect(retainedApis.removeElementsUsingActiveProperties).toBe(
      apis.removeElementsUsingActiveProperties
    )
  })

  it('delegates ID-based element creation through the canonical batch-of-one owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const subscriber = vi.fn()
    const subscription = subscribeToAddElement(subscriber)

    subscriber.mockClear()
    const elementId = apis.createElementInParent(
      {
        id: 'group-1',
        type: 'group',
        x: 10,
        y: 20
      },
      'workspace-1',
      2,
      { shared: 'sceneTree' }
    )

    expect(elementId).toBe('group-1')
    expect(requests.createElementsInParentBatch).toHaveBeenCalledOnce()
    expect(requests.createElementsInParentBatch).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'group-1',
          type: 'group',
          x: 10,
          y: 20
        })
      ],
      'workspace-1',
      2,
      { shared: 'sceneTree' }
    )
    expect(subscriber).toHaveBeenCalledOnce()
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.ADD_ELEMENT,
      payload: {
        data: expect.objectContaining({
          id: 'group-1',
          type: 'group',
          x: 10,
          y: 20
        }),
        parentId: 'workspace-1',
        index: 2
      },
      options: { shared: 'sceneTree' }
    })

    subscription.unsubscribe()
  })

  it('keeps the public single and batch-of-one APIs on the same canonical and compatibility boundary', () => {
    const element = {
      id: 'shared-batch-of-one',
      type: 'rect',
      x: 10,
      y: 20
    }
    const options = { shared: 'sceneTree' } as const

    const singleRequests = createRequests()
    const singleApis = createSceneTreeAPIs(singleRequests)
    const singleSubscriber = vi.fn()
    const singleSubscription = subscribeToAddElement(singleSubscriber)
    singleSubscriber.mockClear()

    const singleElementId = singleApis.createElementInParent(
      element,
      'workspace-1',
      2,
      options
    )
    const singleEvidence = singleSubscriber.mock.calls[0]?.[0]
    singleSubscription.unsubscribe()

    const batchRequests = createRequests()
    const batchApis = createSceneTreeAPIs(batchRequests)
    const batchSubscriber = vi.fn()
    const batchSubscription = subscribeToAddElement(batchSubscriber)
    batchSubscriber.mockClear()

    const batchResult = batchApis.createElementsInParentBatch(
      [element],
      'workspace-1',
      2,
      options
    )

    expect(singleElementId).toBe('shared-batch-of-one')
    expect(batchResult.orderedElementIds).toEqual(['shared-batch-of-one'])
    expect(singleRequests.createElementsInParentBatch).toHaveBeenCalledOnce()
    expect(batchRequests.createElementsInParentBatch).toHaveBeenCalledOnce()
    expect(
      vi.mocked(singleRequests.createElementsInParentBatch).mock.calls[0]
    ).toEqual(
      vi.mocked(batchRequests.createElementsInParentBatch).mock.calls[0]
    )
    expect(singleSubscriber).toHaveBeenCalledOnce()
    expect(batchSubscriber).toHaveBeenCalledOnce()
    expect(batchSubscriber).toHaveBeenCalledWith(singleEvidence)

    batchSubscription.unsubscribe()
  })

  it('publishes compatibility evidence once for internal batch-of-one creation but not per item for canonical bulk creation', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const subscriber = vi.fn()
    const subscription = subscribeToAddElement(subscriber)
    subscriber.mockClear()

    expect(
      apis.createElement({
        id: 'internal-batch-of-one',
        type: 'rect',
        x: 0,
        y: 0
      })
    ).toBe('internal-batch-of-one')
    expect(requests.createElements).toHaveBeenCalledOnce()
    expect(subscriber).toHaveBeenCalledOnce()

    subscriber.mockClear()
    apis.createElementsInParentBatch(
      [
        { id: 'bulk-1', type: 'rect', x: 0, y: 0 },
        { id: 'bulk-2', type: 'rect', x: 10, y: 10 }
      ],
      'workspace-1'
    )
    expect(requests.createElementsInParentBatch).toHaveBeenCalledOnce()
    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('rejects malformed batch-of-one owner results before publishing compatibility evidence', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const subscriber = vi.fn()
    const subscription = subscribeToAddElement(subscriber)
    subscriber.mockClear()
    vi.mocked(requests.createElements).mockReturnValueOnce({
      orderedElementIds: [],
      deliveryHandle,
      timing
    })

    expect(() =>
      apis.createElement({
        id: 'missing-single-result',
        type: 'rect',
        x: 0,
        y: 0
      })
    ).toThrow(/exactly one ordered element id/i)
    expect(subscriber).not.toHaveBeenCalled()

    vi.mocked(requests.createElementsInParentBatch).mockReturnValueOnce({
      orderedElementIds: ['different-single-result'],
      deliveryHandle,
      timing
    })
    expect(() =>
      apis.createElementInParent(
        {
          id: 'expected-single-result',
          type: 'rect',
          x: 0,
          y: 0
        },
        'workspace-1'
      )
    ).toThrow(/expected canonical element id/i)
    expect(subscriber).not.toHaveBeenCalled()

    vi.mocked(requests.createElementsInParentBatch).mockReturnValueOnce({
      orderedElementIds: [],
      deliveryHandle,
      timing
    })
    expect(() =>
      apis.createElementsInParentBatch(
        [
          {
            id: 'missing-public-batch-of-one-result',
            type: 'rect',
            x: 0,
            y: 0
          }
        ],
        'workspace-1'
      )
    ).toThrow(/exactly one ordered element id/i)
    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('returns ordered ids with the original Factory handle and delegates the legacy bulk API to the same owner', () => {
    const requests = createRequests()
    const batchApis = createSceneTreeAPIs(requests) as ReturnType<
      typeof createSceneTreeAPIs
    > &
      CanonicalElementBatchFacadeContract
    const result = batchApis.createElementsInParentBatch(
      [
        { id: 'vector-1', type: 'vector', x: 10, y: 20 },
        { id: 'vector-2', type: 'vector', x: 30, y: 40 }
      ],
      'workspace-1',
      3,
      { shared: 'sceneTree' }
    )

    expect(result.orderedElementIds).toEqual(['vector-1', 'vector-2'])
    expect(result).toBe(
      vi.mocked(requests.createElementsInParentBatch).mock.results[0]?.value
    )
    expect(result.deliveryHandle).toBe(
      vi.mocked(requests.createElementsInParentBatch).mock.results[0]?.value
        .deliveryHandle
    )
    expect(result.timing).toBe(timing)
    expect(requests.createElementsInParentBatch).toHaveBeenCalledOnce()

    const { createElementsInParent } = batchApis
    const elementIds = createElementsInParent(
      [
        { id: 'legacy-vector-1', type: 'vector', x: 10, y: 20 },
        { id: 'legacy-vector-2', type: 'vector', x: 30, y: 40 }
      ],
      'workspace-1',
      3,
      { shared: 'sceneTree' }
    )

    expect(elementIds).toEqual(['legacy-vector-1', 'legacy-vector-2'])
    expect(requests.createElementsInParentBatch).toHaveBeenCalledTimes(2)
    expect(requests.createElementsInParentBatch).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({ id: 'legacy-vector-1', type: 'vector' }),
        expect.objectContaining({ id: 'legacy-vector-2', type: 'vector' })
      ],
      'workspace-1',
      3,
      { shared: 'sceneTree' }
    )
    expect(requests.createElementsInParent).not.toHaveBeenCalled()
    expect(acceptBatchExtensionContract(batchApis).createElementsInParent).toBe(
      batchApis.createElementsInParent
    )
    const publicContract: CanonicalBatchExtensionContract = batchApis
    expect(publicContract.createElementsInParentBatch).toBe(
      batchApis.createElementsInParentBatch
    )
  })

  it('delegates exact canonical property and element data without preparing it twice', () => {
    const exactElements = [
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
    const exactProperties = [
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
    const canonicalRequest = requests.createElementsInParentFromCanonicalData
    const apis = createSceneTreeAPIs(requests)

    expect(
      apis.createElementsInParentFromCanonicalData(
        exactElements,
        exactProperties,
        'workspace-1',
        4,
        { shared: 'sceneTree' }
      )
    ).toEqual(['canonical-rect'])
    expect(canonicalRequest).toHaveBeenCalledWith(
      exactElements,
      exactProperties,
      'workspace-1',
      4,
      { shared: 'sceneTree' }
    )
    expect(
      acceptBatchExtensionContract(apis).createElementsInParentFromCanonicalData
    ).toBe(apis.createElementsInParentFromCanonicalData)
  })

  it('delegates exact canonical elements against already active property evidence', () => {
    const exactElements = [
      {
        id: 'active-canonical-rect',
        type: 'rect',
        name: 'Active Canonical Rectangle',
        parentId: 'workspace-1',
        visible: true,
        lock: false,
        props: {
          position: 'active-canonical-position',
          dimension: 'active-canonical-dimension'
        }
      }
    ] satisfies readonly ElementRawData[]
    const exactProperties = [
      {
        id: 'active-canonical-position',
        type: 'position',
        x: 10,
        y: 20,
        xUnit: 'px',
        yUnit: 'px'
      },
      {
        id: 'active-canonical-dimension',
        type: 'dimension',
        width: 30,
        height: 40,
        widthUnit: 'px',
        heightUnit: 'px'
      }
    ] as unknown as readonly PropertyComponentRawData[]
    const requests = createRequests()
    const activeCanonicalRequest =
      requests.createElementsInParentFromCanonicalDataUsingActiveProperties
    const apis = createSceneTreeAPIs(requests)

    expect(
      apis.createElementsInParentFromCanonicalDataUsingActiveProperties(
        exactElements,
        exactProperties,
        'workspace-1',
        4,
        { shared: 'sceneTree' }
      )
    ).toEqual(['active-canonical-rect'])
    expect(activeCanonicalRequest).toHaveBeenCalledWith(
      exactElements,
      exactProperties,
      'workspace-1',
      4,
      { shared: 'sceneTree' }
    )
    expect(
      acceptBatchExtensionContract(apis)
        .createElementsInParentFromCanonicalDataUsingActiveProperties
    ).toBe(apis.createElementsInParentFromCanonicalDataUsingActiveProperties)
  })

  it('treats an empty exact canonical batch as a no-op and rejects orphan properties', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const orphanProperty = {
      id: 'orphan-position',
      type: 'position'
    } as PropertyComponentRawData

    expect(
      apis.createElementsInParentFromCanonicalData([], [], 'missing-parent')
    ).toEqual([])
    expect(
      requests.createElementsInParentFromCanonicalData
    ).not.toHaveBeenCalled()
    expect(
      apis.createElementsInParentFromCanonicalDataUsingActiveProperties(
        [],
        [],
        'missing-parent'
      )
    ).toEqual([])
    expect(
      requests.createElementsInParentFromCanonicalDataUsingActiveProperties
    ).not.toHaveBeenCalled()
    expect(() =>
      apis.createElementsInParentFromCanonicalData(
        [],
        [orphanProperty],
        'missing-parent'
      )
    ).toThrow(/orphan propert/i)
    expect(
      requests.createElementsInParentFromCanonicalData
    ).not.toHaveBeenCalled()
    expect(() =>
      apis.createElementsInParentFromCanonicalDataUsingActiveProperties(
        [],
        [orphanProperty],
        'missing-parent'
      )
    ).toThrow(/orphan propert/i)
    expect(
      requests.createElementsInParentFromCanonicalDataUsingActiveProperties
    ).not.toHaveBeenCalled()
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

  it('delegates ID-based move requests and options to the supplied Scene Tree owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const request = {
      elementIds: ['element-2', 'element-1'],
      targetParentId: 'group-1',
      targetIndex: 0
    }
    const options = { undoable: false as const }

    apis.moveElements(request, options)

    expect(requests.moveElements).toHaveBeenCalledWith(request, options)
  })

  it('delegates subtree removal by id to the supplied Scene Tree owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)

    apis.removeSubtree('group-1', { rollbackable: false })

    expect(requests.removeSubtree).toHaveBeenCalledWith('group-1', {
      rollbackable: false
    })
  })

  it('delegates exact active-property removal evidence to the matching Scene Tree owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
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

    expect(
      apis.removeElementsUsingActiveProperties(removals, {
        rollbackable: false
      })
    ).toEqual(['element-1'])
    expect(requests.removeElementsUsingActiveProperties).toHaveBeenCalledWith(
      removals,
      { rollbackable: false }
    )
    expect(
      apis.removeElementUsingActiveProperties(removals[0], {
        rollbackable: false
      })
    ).toBe(true)
    expect(requests.removeElementUsingActiveProperties).toHaveBeenCalledWith(
      removals[0],
      { rollbackable: false }
    )
    apis.removeSubtreeUsingActiveProperties('group-1', {
      rollbackable: false
    })
    expect(requests.removeSubtreeUsingActiveProperties).toHaveBeenCalledWith(
      'group-1',
      { rollbackable: false }
    )
  })
})

describe('createSceneTreeAPIs.changeComputedData', () => {
  it('does nothing when data is empty', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const subscriber = vi.fn()
    const subscription = subscribeToChangeComputedData(subscriber)

    subscriber.mockClear()
    apis.changeComputedData(['element-1'], {})

    expect(subscriber).not.toHaveBeenCalled()
    subscription.unsubscribe()
  })

  it('batches transient computed data changes with undoable=false', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const singleSubscriber = vi.fn()
    const batchSubscriber = vi.fn()
    const singleSubscription = subscribeToChangeComputedData(singleSubscriber)
    const batchSubscription =
      subscribeToChangeComputedDataBatch(batchSubscriber)

    singleSubscriber.mockClear()
    batchSubscriber.mockClear()
    apis.changeComputedData(
      ['element-1'],
      {
        x: 120,
        y: 240
      },
      { undoable: false }
    )

    expect(singleSubscriber).not.toHaveBeenCalled()
    expect(batchSubscriber).toHaveBeenCalledTimes(1)
    expect(batchSubscriber).toHaveBeenCalledWith({
      type: EventTypes.CHANGE_COMPUTED_DATA_BATCH,
      payload: {
        elementIds: ['element-1'],
        data: {
          x: 120,
          y: 240
        }
      },
      options: {
        undoable: false
      }
    })

    singleSubscription.unsubscribe()
    batchSubscription.unsubscribe()
  })

  it('keeps default undoable=true behavior when options are omitted', () => {
    const apis = createSceneTreeAPIs(createRequests())
    const subscriber = vi.fn()
    const subscription = subscribeToChangeComputedData(subscriber)

    subscriber.mockClear()
    apis.changeComputedData(['element-1'], { width: 320 })

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.CHANGE_COMPUTED_DATA,
      payload: {
        elementIds: ['element-1'],
        key: 'width',
        data: 320
      },
      options: {
        undoable: true
      }
    })

    subscription.unsubscribe()
  })
})

describe('createSceneTreeAPIs.createElement', () => {
  it('delegates the parent-optional single API through the canonical batch-of-one owner', () => {
    const requests = createRequests()
    const apis = createSceneTreeAPIs(requests)
    const subscriber = vi.fn()
    const subscription = subscribeToAddElement(subscriber)

    subscriber.mockClear()
    apis.createElement(
      {
        id: 'element-1',
        type: 'rect',
        x: 10,
        y: 20
      },
      undefined,
      undefined,
      { undoable: false }
    )

    expect(requests.createElements).toHaveBeenCalledOnce()
    expect(requests.createElements).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 'element-1',
          type: 'rect',
          x: 10,
          y: 20
        })
      ],
      undefined,
      undefined,
      { undoable: false }
    )
    expect(subscriber).toHaveBeenCalledOnce()
    expect(subscriber).toHaveBeenCalledWith({
      type: EventTypes.ADD_ELEMENT,
      payload: {
        data: expect.objectContaining({
          id: 'element-1',
          type: 'rect',
          x: 10,
          y: 20
        }),
        parent: undefined,
        index: undefined
      },
      options: { undoable: false }
    })

    subscription.unsubscribe()
  })
})
