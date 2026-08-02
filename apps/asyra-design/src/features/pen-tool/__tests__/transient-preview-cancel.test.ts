import { beforeEach, describe, expect, it, vi } from 'vitest'

interface CapturedSessionDefinition {
  readonly session?: {
    readonly onUpdate?: (
      snapshot: unknown,
      state: Record<string, unknown>
    ) => unknown
    readonly onEnd?: (
      snapshot: unknown,
      state: Record<string, unknown>
    ) => unknown
    readonly onCancel?: (
      snapshot: unknown,
      state: Record<string, unknown>
    ) => unknown
  }
}

const mocks = vi.hoisted(() => ({
  definitions: new Map<string, CapturedSessionDefinition>(),
  discardTransientVectorPreviews: vi.fn(),
  getMousePosInWorkspace: vi.fn(
    (position: { x: number; y: number }) => position
  ),
  getVectorAnchorPointById: vi.fn(() => ({
    index: 0,
    point: {
      id: 'point-a',
      kind: 'anchor',
      x: 10,
      y: 20
    }
  })),
  getVectorAnchorPointHandleMode: vi.fn(() => 'none'),
  hasMovedBeyondThreshold: vi.fn(() => true),
  resetCanvasCursor: vi.fn(),
  setPathEditingVectorId: vi.fn(),
  setPathEditingStartNewSubpath: vi.fn(),
  setPathEditingContinuation: vi.fn(),
  setSelectedVectorPoint: vi.fn(),
  setSelectedVectorSegment: vi.fn(),
  setHoveredVectorPoint: vi.fn(),
  setHoveredVectorSegment: vi.fn(),
  setHoveredVectorSegmentInsertPoint: vi.fn(),
  updateVectorAnchorPointPosition: vi.fn(() => true)
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
    discardTransientVectorPreviews: mocks.discardTransientVectorPreviews,
    getMousePosInWorkspace: mocks.getMousePosInWorkspace,
    getVectorAnchorPointById: mocks.getVectorAnchorPointById,
    getVectorAnchorPointHandleMode: mocks.getVectorAnchorPointHandleMode,
    hasMovedBeyondThreshold: mocks.hasMovedBeyondThreshold,
    updateVectorAnchorPointPosition: mocks.updateVectorAnchorPointPosition
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

  it('commits an existing vector point drag through immediate shared delivery on pointer-up', () => {
    const session = mocks.definitions.get(
      FeatureNames.SELECT_VECTOR_POINT
    )?.session

    session?.onEnd?.(
      {
        mouseDragStart: { x: 20, y: 30 },
        mousePosition: { x: 50, y: 60 }
      },
      {
        dragTarget: {
          elementId: 'selected-vector',
          pointId: 'point-a',
          index: 0,
          target: 'anchor',
          dragStartWorkspacePos: { x: 20, y: 30 },
          initialTargetPos: { x: 10, y: 20 },
          hasMoved: true
        },
        runtimeBefore
      }
    )

    expect(mocks.updateVectorAnchorPointPosition).toHaveBeenLastCalledWith(
      'selected-vector',
      'point-a',
      { x: 40, y: 50 },
      {
        undoable: true,
        sharedDelivery: 'immediate',
        skipResult: true
      }
    )
    expect(mocks.discardTransientVectorPreviews).toHaveBeenCalledWith([
      'selected-vector'
    ])
    expect(
      mocks.discardTransientVectorPreviews.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mocks.updateVectorAnchorPointPosition.mock.invocationCallOrder.at(-1) ??
        Number.POSITIVE_INFINITY
    )
  })

  it('keeps existing vector point drag updates in the local transient preview', () => {
    const session = mocks.definitions.get(
      FeatureNames.SELECT_VECTOR_POINT
    )?.session

    session?.onUpdate?.(
      {
        mouseDragStart: { x: 20, y: 30 },
        mousePosition: { x: 50, y: 60 },
        mouseDragging: true
      },
      {
        dragTarget: {
          elementId: 'selected-vector',
          pointId: 'point-a',
          index: 0,
          target: 'anchor',
          dragStartWorkspacePos: { x: 20, y: 30 },
          initialTargetPos: { x: 10, y: 20 },
          hasMoved: false
        },
        runtimeBefore
      }
    )

    expect(mocks.updateVectorAnchorPointPosition).toHaveBeenLastCalledWith(
      'selected-vector',
      'point-a',
      { x: 40, y: 50 },
      {
        undoable: false,
        transientPreview: true,
        skipResult: true
      }
    )
  })
})
