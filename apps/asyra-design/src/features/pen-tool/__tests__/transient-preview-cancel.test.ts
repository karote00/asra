import { beforeEach, describe, expect, it, vi } from 'vitest'

interface CapturedSessionDefinition {
  readonly session?: {
    readonly onCancel?: (
      snapshot: unknown,
      state: Record<string, unknown>
    ) => unknown
  }
}

const mocks = vi.hoisted(() => ({
  definitions: new Map<string, CapturedSessionDefinition>(),
  discardTransientVectorPreviews: vi.fn(),
  resetCanvasCursor: vi.fn(),
  setPathEditingVectorId: vi.fn(),
  setPathEditingStartNewSubpath: vi.fn(),
  setPathEditingContinuation: vi.fn(),
  setSelectedVectorPoint: vi.fn(),
  setSelectedVectorSegment: vi.fn(),
  setHoveredVectorPoint: vi.fn(),
  setHoveredVectorSegment: vi.fn(),
  setHoveredVectorSegmentInsertPoint: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  defineFeature: (
    name: string,
    _event: unknown,
    definition: CapturedSessionDefinition
  ) => {
    mocks.definitions.set(name, definition)
    return { api: {}, dispose: vi.fn() }
  }
}))

vi.mock('../../../common-apis', () => ({
  cursorApis: {
    resetCanvasCursor: mocks.resetCanvasCursor
  },
  elementApis: {
    discardTransientVectorPreviews: mocks.discardTransientVectorPreviews
  },
  selectionApis: {},
  systemContextApis: {
    setPathEditingVectorId: mocks.setPathEditingVectorId,
    setPathEditingStartNewSubpath: mocks.setPathEditingStartNewSubpath,
    setPathEditingContinuation: mocks.setPathEditingContinuation,
    setSelectedVectorPoint: mocks.setSelectedVectorPoint,
    setSelectedVectorSegment: mocks.setSelectedVectorSegment,
    setHoveredVectorPoint: mocks.setHoveredVectorPoint,
    setHoveredVectorSegment: mocks.setHoveredVectorSegment,
    setHoveredVectorSegmentInsertPoint: mocks.setHoveredVectorSegmentInsertPoint
  }
}))

import { FeatureNames } from '../../../constants'
import '../feature'

const runtimeBefore = {
  pathEditingVectorId: 'vector-before',
  pathEditingStartNewSubpath: false,
  pathEditingContinuation: null,
  selectedVectorPoint: null,
  selectedVectorSegment: null,
  hoveredVectorPoint: null,
  hoveredVectorSegment: null,
  hoveredVectorSegmentInsertPoint: null
}

describe('Pen Tool transient preview cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('discards the Pen curve preview before forced rollback cleanup returns', () => {
    const session = mocks.definitions.get(FeatureNames.PEN)?.session

    session?.onCancel?.(
      {},
      {
        elementId: 'pen-vector',
        runtimeBefore
      }
    )

    expect(mocks.discardTransientVectorPreviews).toHaveBeenCalledWith([
      'pen-vector'
    ])
    expect(
      mocks.discardTransientVectorPreviews.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.setPathEditingVectorId.mock.invocationCallOrder[0])
    expect(
      mocks.discardTransientVectorPreviews.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.resetCanvasCursor.mock.invocationCallOrder[0])
  })

  it('discards an existing vector point preview before forced rollback cleanup returns', () => {
    const session = mocks.definitions.get(
      FeatureNames.SELECT_VECTOR_POINT
    )?.session

    session?.onCancel?.(
      {},
      {
        dragTarget: {
          elementId: 'selected-vector'
        },
        runtimeBefore
      }
    )

    expect(mocks.discardTransientVectorPreviews).toHaveBeenCalledWith([
      'selected-vector'
    ])
    expect(
      mocks.discardTransientVectorPreviews.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.setPathEditingVectorId.mock.invocationCallOrder[0])
    expect(
      mocks.discardTransientVectorPreviews.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.resetCanvasCursor.mock.invocationCallOrder[0])
  })
})
