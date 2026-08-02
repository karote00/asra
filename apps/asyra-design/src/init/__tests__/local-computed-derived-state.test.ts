import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface OrdinaryComputedEvent {
  readonly type: string
  readonly payload: {
    readonly id: string
    readonly key?: string
    readonly changes?: readonly {
      readonly owner: string
      readonly key: string
      readonly before: unknown
      readonly after: unknown
    }[]
    readonly patch?: {
      readonly values?: Readonly<
        Record<string, { readonly before: unknown; readonly after: unknown }>
      >
      readonly records?: Readonly<Record<string, unknown>>
    }
  }
}

type OrdinaryEventSubscriber = (event: OrdinaryComputedEvent) => void
type OrdinaryBatchSubscriber = (
  events: readonly OrdinaryComputedEvent[]
) => void

const mocks = vi.hoisted(() => ({
  ordinaryBatchSubscribers: [] as OrdinaryBatchSubscriber[],
  updateComputedSubscribers: [] as OrdinaryEventSubscriber[],
  updateComputedPatchSubscribers: [] as OrdinaryEventSubscriber[],
  subscribeToEventBatches: vi.fn(),
  subscribeToUpdateComputedData: vi.fn(),
  subscribeToUpdateComputedDataPatch: vi.fn(),
  subscribeToChangeComputedData: vi.fn(),
  subscribeToAddElement: vi.fn(),
  subscribeToRemoveElement: vi.fn(),
  subscribeToFileLoadComplete: vi.fn(),
  subscribeToSceneTreeLoadComplete: vi.fn(),
  systemProperties: new Map<string, unknown>(),
  getSystemProperty: vi.fn(),
  setSystemProperty: vi.fn(),
  getSystemPropertyObservable: vi.fn(),
  onUIPropertyChange: vi.fn(),
  defineUIProperty: vi.fn(),
  setUIProperty: vi.fn(),
  getAllElements: vi.fn(),
  getElementById: vi.fn(),
  getVectorAnchorSubpaths: vi.fn(),
  getVectorAnchorContinuation: vi.fn(),
  getVectorTopology: vi.fn(),
  buildVectorIconPath: vi.fn()
}))

vi.mock('@asyra/reactive-events', () => ({
  EventTypes: {
    UPDATE_COMPUTED_DATA: 'updateComputedData',
    UPDATE_COMPUTED_DATA_PATCH: 'updateComputedDataPatch'
  },
  subscribeToEventBatches: (subscriber: OrdinaryBatchSubscriber) => {
    mocks.subscribeToEventBatches(subscriber)
    mocks.ordinaryBatchSubscribers.push(subscriber)
    return { unsubscribe: vi.fn() }
  },
  subscribeToUpdateComputedData: (subscriber: OrdinaryEventSubscriber) => {
    mocks.subscribeToUpdateComputedData(subscriber)
    mocks.updateComputedSubscribers.push(subscriber)
    return { unsubscribe: vi.fn() }
  },
  subscribeToUpdateComputedDataPatch: (subscriber: OrdinaryEventSubscriber) => {
    mocks.subscribeToUpdateComputedDataPatch(subscriber)
    mocks.updateComputedPatchSubscribers.push(subscriber)
    return { unsubscribe: vi.fn() }
  },
  subscribeToChangeComputedData: mocks.subscribeToChangeComputedData,
  subscribeToAddElement: mocks.subscribeToAddElement,
  subscribeToRemoveElement: mocks.subscribeToRemoveElement,
  subscribeToFileLoadComplete: mocks.subscribeToFileLoadComplete,
  subscribeToSceneTreeLoadComplete: mocks.subscribeToSceneTreeLoadComplete
}))

vi.mock('@asyra/core', () => ({
  VECTOR_TOKENS: {
    POINT: {
      TARGET: {
        ANCHOR: 'anchor'
      }
    }
  }
}))

vi.mock('@asyra/preset', () => ({
  PresetSystemPropertyKeys: {
    PATH_EDITING_CONTINUATION: 'pathEditingContinuation',
    PATH_EDITING_MODE: 'pathEditingMode',
    PATH_EDITING_START_NEW_SUBPATH: 'pathEditingStartNewSubpath',
    PATH_EDITING_VECTOR_ID: 'pathEditingVectorId',
    SELECTED_VECTOR_POINT: 'selectedVectorPoint'
  }
}))

vi.mock('../../contexts', () => ({
  default: {
    defineUIProperty: mocks.defineUIProperty,
    getSystemProperty: mocks.getSystemProperty,
    getSystemPropertyObservable: mocks.getSystemPropertyObservable,
    onUIPropertyChange: mocks.onUIPropertyChange,
    setSystemProperty: mocks.setSystemProperty,
    setUIProperty: mocks.setUIProperty
  },
  sceneTree: {
    getAllElements: mocks.getAllElements,
    getElementById: mocks.getElementById
  }
}))

vi.mock('../../common-apis', () => ({
  elementApis: {
    getVectorAnchorContinuation: mocks.getVectorAnchorContinuation,
    getVectorAnchorSubpaths: mocks.getVectorAnchorSubpaths,
    getVectorTopology: mocks.getVectorTopology
  }
}))

vi.mock('../../constants', () => ({
  UI_PROPERTIES: {
    VECTOR_ICON_PATH_MAP: 'vectorIconPathMap'
  }
}))

vi.mock('../../utils/vector-icon-path', () => ({
  buildVectorIconPath: mocks.buildVectorIconPath
}))

import { initVectorIconData } from '../capabilities/init-vector-icon-data'
import { initPathEditingContinuation } from '../derived-state/init-path-editing-continuation'

const scalarTopologyEvent = (
  id: string,
  key = 'points'
): OrdinaryComputedEvent => ({
  type: 'updateComputedData',
  payload: {
    id,
    key
  }
})

const batchTopologyEvent = (id: string): OrdinaryComputedEvent => ({
  type: 'updateComputedData',
  payload: {
    id,
    changes: [
      {
        owner: 'computed',
        key: 'segments',
        before: [],
        after: []
      },
      {
        owner: 'computed',
        key: 'closed',
        before: false,
        after: true
      }
    ]
  }
})

const patchTopologyEvent = (id: string): OrdinaryComputedEvent => ({
  type: 'updateComputedDataPatch',
  payload: {
    id,
    patch: {
      values: {
        networks: {
          before: [],
          after: []
        }
      },
      records: {
        points: {
          set: {}
        }
      }
    }
  }
})

const dispatchOrdinaryEvents = (
  events: readonly OrdinaryComputedEvent[]
): void => {
  mocks.ordinaryBatchSubscribers.forEach((subscriber) => subscriber(events))
  events.forEach((event) => {
    if (event.type === 'updateComputedData') {
      mocks.updateComputedSubscribers.forEach((subscriber) => subscriber(event))
    }
    if (event.type === 'updateComputedDataPatch') {
      mocks.updateComputedPatchSubscribers.forEach((subscriber) =>
        subscriber(event)
      )
    }
  })
}

describe('local computed derived-state initialization', () => {
  beforeEach(() => {
    mocks.ordinaryBatchSubscribers.length = 0
    mocks.updateComputedSubscribers.length = 0
    mocks.updateComputedPatchSubscribers.length = 0
    mocks.systemProperties.clear()
    Object.values(mocks).forEach((value) => {
      if (typeof value === 'function' && 'mockClear' in value) {
        value.mockClear()
      }
    })

    mocks.getSystemProperty.mockImplementation((key: string) =>
      mocks.systemProperties.get(key)
    )
    mocks.setSystemProperty.mockImplementation(
      (key: string, value: unknown) => {
        mocks.systemProperties.set(key, value)
      }
    )
    mocks.getSystemPropertyObservable.mockReturnValue(undefined)
    mocks.getAllElements.mockReturnValue(new Map())
    mocks.getElementById.mockReturnValue({
      get: (key: string) => (key === 'type' ? 'vector' : undefined)
    })
    mocks.getVectorAnchorSubpaths.mockReturnValue([
      [{ id: 'point-1' }, { id: 'point-2' }]
    ])
    mocks.getVectorAnchorContinuation.mockReturnValue({
      networkId: 'network-1',
      pointId: 'point-2',
      side: 'end'
    })
    mocks.getVectorTopology.mockImplementation((elementId: string) => ({
      elementId
    }))
    mocks.buildVectorIconPath.mockImplementation(
      (topology: { elementId: string }) => `icon:${topology.elementId}`
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('syncs path continuation once for each relevant ordinary scalar, batch, and patch event', () => {
    mocks.systemProperties.set('pathEditingVectorId', 'vector-1')
    mocks.systemProperties.set('pathEditingStartNewSubpath', false)
    mocks.systemProperties.set('selectedVectorPoint', null)
    mocks.systemProperties.set('pathEditingContinuation', null)

    initPathEditingContinuation()
    mocks.getVectorAnchorSubpaths.mockClear()

    dispatchOrdinaryEvents([
      scalarTopologyEvent('vector-1'),
      batchTopologyEvent('vector-1'),
      patchTopologyEvent('vector-1'),
      scalarTopologyEvent('vector-1', 'x'),
      scalarTopologyEvent('other-vector')
    ])

    expect(mocks.getVectorAnchorSubpaths).toHaveBeenCalledTimes(3)
    expect(mocks.subscribeToChangeComputedData).not.toHaveBeenCalled()
  })

  it('enqueues each affected vector once for each ordinary scalar, batch, and patch event', () => {
    const frameCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      })
    )
    mocks.systemProperties.set('pathEditingMode', false)

    initVectorIconData()
    mocks.getVectorTopology.mockClear()
    mocks.buildVectorIconPath.mockClear()

    const dispatchAndFlush = (event: OrdinaryComputedEvent): void => {
      dispatchOrdinaryEvents([event])
      const callback = frameCallbacks.shift()
      expect(callback).toBeTypeOf('function')
      callback?.(0)
    }

    dispatchAndFlush(scalarTopologyEvent('vector-scalar'))
    dispatchAndFlush(batchTopologyEvent('vector-batch'))
    dispatchAndFlush(patchTopologyEvent('vector-patch'))
    dispatchOrdinaryEvents([scalarTopologyEvent('vector-ignored', 'x')])

    expect(
      mocks.getVectorTopology.mock.calls.map(([elementId]) => elementId)
    ).toEqual(['vector-scalar', 'vector-batch', 'vector-patch'])
    expect(mocks.buildVectorIconPath).toHaveBeenCalledTimes(3)
    expect(frameCallbacks).toHaveLength(0)
    expect(mocks.subscribeToChangeComputedData).not.toHaveBeenCalled()
  })
})
