import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComputedDataPatch, DataTypes } from '@asyra/utils'

const mocks = vi.hoisted(() => ({
  getSystemProperty: vi.fn(),
  patchLocalComputedData: vi.fn(),
  projectLocalComputedDataFromPropertyIds: vi.fn(),
  getElementById: vi.fn()
}))

vi.mock('../../../contexts', () => ({
  default: {
    getSystemProperty: mocks.getSystemProperty,
    patchLocalComputedData: mocks.patchLocalComputedData,
    projectLocalComputedDataFromPropertyIds:
      mocks.projectLocalComputedDataFromPropertyIds
  },
  render: null,
  sceneTree: {
    getElementById: mocks.getElementById
  }
}))

vi.mock('../../selection', () => ({
  selectionApis: {
    clearVectorPointSelection: vi.fn(),
    clearVectorSegmentSelection: vi.fn(),
    getSelectedVectorPoints: vi.fn(() => []),
    getSelectedVectorSegments: vi.fn(() => [])
  }
}))

vi.mock('../../system-context', () => ({
  systemContextApis: {
    getHoveredVectorPoint: vi.fn(() => null),
    getHoveredVectorSegment: vi.fn(() => null),
    getHoveredVectorSegmentInsertPoint: vi.fn(() => null),
    getSelectedVectorPoint: vi.fn(() => null),
    setHoveredVectorPoint: vi.fn(),
    setHoveredVectorSegment: vi.fn(),
    setHoveredVectorSegmentInsertPoint: vi.fn(),
    setSelectedVectorPoint: vi.fn(),
    setSelectedVectorSegment: vi.fn()
  }
}))

import { vectorApis } from '../vector-apis'
import type { VectorComputedData } from '../vector-consistency'

interface VectorPreviewCancellationAPI {
  discardTransientVectorPreviews(elementIds: readonly string[]): void
}

const createVectorComputed = (
  pointBX = 20,
  pointBY = 10
): VectorComputedData => ({
  x: 0,
  y: 0,
  width: pointBX,
  height: pointBY,
  closed: false,
  pointCoordinateSpace: 'workspace',
  points: {
    pointA: {
      anchorType: 'sharp',
      handleMode: 'none',
      id: 'pointA',
      kind: 'anchor',
      x: 0,
      y: 0
    },
    pointB: {
      anchorType: 'sharp',
      handleMode: 'none',
      id: 'pointB',
      kind: 'anchor',
      x: pointBX,
      y: pointBY
    }
  },
  segments: {
    segmentA: {
      endId: 'pointB',
      id: 'segmentA',
      inControlId: null,
      outControlId: null,
      startId: 'pointA'
    }
  },
  networks: {
    networkA: {
      closed: false,
      id: 'networkA',
      pointIds: ['pointA', 'pointB'],
      segmentIds: ['segmentA']
    }
  }
})

const applyComputedPatch = (
  current: VectorComputedData,
  patch: ComputedDataPatch
): VectorComputedData => {
  const next = {
    ...current,
    ...(patch.values ?? {})
  } as VectorComputedData

  Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
    const currentRecord = next[key as keyof VectorComputedData]
    const nextRecord =
      currentRecord &&
      typeof currentRecord === 'object' &&
      !Array.isArray(currentRecord)
        ? {
            ...(currentRecord as unknown as Record<
              string,
              DataTypes | undefined
            >)
          }
        : {}

    Object.entries(recordPatch.set ?? {}).forEach(([recordId, value]) => {
      nextRecord[recordId] = value
    })
    const removeIds = new Set(recordPatch.remove ?? [])
    ;(next as unknown as Record<string, DataTypes>)[key] = Object.fromEntries(
      Object.entries(nextRecord).filter(
        ([recordId]) => !removeIds.has(recordId)
      )
    )
  })

  return next
}

describe('Vector transient preview cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getElementById.mockImplementation((elementId: string) => ({
      get: (key: string) => (key === 'type' ? 'vector' : undefined),
      props: {
        getCanonicalRootPropertyIds: () => [`${elementId}-vector-root`]
      }
    }))
  })

  it('clears one preview batch and reprojects its current canonical property roots', () => {
    const api = vectorApis as typeof vectorApis & VectorPreviewCancellationAPI

    api.discardTransientVectorPreviews(['vector-b', 'vector-a'])

    expect(mocks.projectLocalComputedDataFromPropertyIds).toHaveBeenCalledOnce()
    expect(mocks.projectLocalComputedDataFromPropertyIds).toHaveBeenCalledWith([
      'vector-b-vector-root',
      'vector-a-vector-root'
    ])
  })

  it('restores canonical computed and workspace topology after discarding a transient preview', () => {
    const elementId = 'vector-cache-regression'
    const propertyId = `${elementId}-vector-root`
    let computed = createVectorComputed()
    const api = vectorApis as typeof vectorApis & VectorPreviewCancellationAPI

    mocks.getSystemProperty.mockImplementation((key: string) =>
      ['pathEditingMode', 'mouseDragging'].includes(key)
    )
    mocks.getElementById.mockImplementation((requestedId: string) => {
      if (requestedId !== elementId) {
        return null
      }
      return {
        get: (key: string) => (key === 'type' ? 'vector' : undefined),
        getAllComputedData: () => computed,
        props: {
          getCanonicalRootPropertyIds: () => [propertyId]
        }
      }
    })
    mocks.patchLocalComputedData.mockImplementation(
      (
        updates: readonly {
          elementId: string
          patch: ComputedDataPatch
        }[]
      ) => {
        updates.forEach((update) => {
          if (update.elementId === elementId) {
            computed = applyComputedPatch(computed, update.patch)
          }
        })
      }
    )
    mocks.projectLocalComputedDataFromPropertyIds.mockImplementation(
      (propertyIds: readonly string[]) => {
        if (propertyIds.includes(propertyId)) {
          computed = createVectorComputed()
        }
      }
    )

    expect(api.getVectorAnchorPointById(elementId, 'pointB')?.point.x).toBe(20)
    expect(
      api.updateVectorAnchorPointPosition(
        elementId,
        'pointB',
        { x: 25, y: 15 },
        {
          skipResult: true,
          transientPreview: true,
          undoable: false
        }
      )
    ).toBe(true)
    expect(api.getVectorTopology(elementId).points.pointB?.x).toBe(25)
    expect(api.getVectorAnchorPointById(elementId, 'pointB')?.point.x).toBe(25)

    api.discardTransientVectorPreviews([elementId])

    expect(mocks.projectLocalComputedDataFromPropertyIds).toHaveBeenCalledWith([
      propertyId
    ])
    expect(api.getVectorTopology(elementId).points.pointB?.x).toBe(20)
    expect(api.getVectorAnchorPointById(elementId, 'pointB')?.point.x).toBe(20)
  })
})
