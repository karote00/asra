import { beforeEach, describe, expect, it, vi } from 'vitest'

type BatchSubscriber = (
  events: readonly {
    readonly type: string
    readonly payload: Readonly<Record<string, unknown>>
  }[]
) => void

const mocks = vi.hoisted(() => ({
  anchorX: 12,
  batchSubscriber: undefined as BatchSubscriber | undefined,
  getSystemProperty: vi.fn(),
  getSystemPropertyObservable: vi.fn(),
  getUIProperty: vi.fn(),
  onUIPropertyChange: vi.fn(),
  setSystemProperty: vi.fn(),
  setUIProperty: vi.fn()
}))

vi.mock('@asyra/reactive-events', () => ({
  EventTypes: {
    UPDATE_COMPUTED_DATA: 'updateComputedData',
    UPDATE_COMPUTED_DATA_PATCH: 'updateComputedDataPatch'
  },
  subscribeToEventBatches: (subscriber: BatchSubscriber) => {
    mocks.batchSubscriber = subscriber
    return { unsubscribe: vi.fn() }
  }
}))

vi.mock('@asyra/preset', () => ({
  PresetSystemPropertyKeys: {
    PATH_EDITING_VECTOR_ID: 'pathEditingVectorId',
    SELECTED_VECTOR_POINT: 'selectedVectorPoint',
    SELECTED_VECTOR_SEGMENT: 'selectedVectorSegment'
  }
}))

vi.mock('../../contexts', () => ({
  default: {
    getSystemProperty: mocks.getSystemProperty,
    getSystemPropertyObservable: mocks.getSystemPropertyObservable,
    getUIProperty: mocks.getUIProperty,
    onUIPropertyChange: mocks.onUIPropertyChange,
    setSystemProperty: mocks.setSystemProperty,
    setUIProperty: mocks.setUIProperty
  }
}))

vi.mock('../../common-apis/element', () => ({
  elementApis: {
    getVectorAnchorPointById: () => ({
      index: 0,
      point: {
        inHandle: null,
        outHandle: null,
        x: mocks.anchorX,
        y: 24
      }
    }),
    getVectorAnchorPointHandleMode: () => 'none'
  }
}))

vi.mock('../../common-apis/selection', () => ({
  decodeVectorPointSelectionId: () => ({
    elementId: 'vector-1',
    pointId: 'point-1',
    target: 'anchor'
  }),
  decodeVectorSegmentSelectionId: () => null
}))

import { initSelectionCompatibility } from '../derived-state/init-selection-compatibility'

describe('selection compatibility projection', () => {
  beforeEach(() => {
    mocks.anchorX = 12
    mocks.batchSubscriber = undefined
    mocks.getUIProperty.mockImplementation((key: string) =>
      key === 'vectorPointSelection'
        ? new Set(['vector-1:point-1:anchor'])
        : new Set()
    )
    mocks.getSystemProperty.mockImplementation((key: string) =>
      key === 'pathEditingVectorId' ? 'vector-1' : null
    )
    mocks.getSystemPropertyObservable.mockReturnValue(undefined)
    mocks.setSystemProperty.mockClear()
    mocks.setUIProperty.mockClear()
  })

  it('refreshes the selected point from the ordinary local computed batch', () => {
    initSelectionCompatibility()
    mocks.setSystemProperty.mockClear()
    mocks.anchorX = 48

    mocks.batchSubscriber?.([
      {
        type: 'updateComputedDataPatch',
        payload: {
          id: 'vector-1',
          patch: {
            records: {
              points: {
                set: {
                  'point-1': { x: 48, y: 24 }
                }
              }
            }
          }
        }
      }
    ])

    expect(mocks.setSystemProperty).toHaveBeenCalledWith(
      'selectedVectorPoint',
      expect.objectContaining({
        elementId: 'vector-1',
        pointId: 'point-1',
        x: 48,
        y: 24
      })
    )
  })
})
