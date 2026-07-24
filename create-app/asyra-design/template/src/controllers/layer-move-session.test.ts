import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InputSystemEvents } from '../constants'
import type { ValidLayerDropIntent } from './layer-drop-intent'
import type { LayerMoveSourcePlan } from './layer-move-source'
import type { LayerPointerSession } from './layer-pointer-session'

const mocks = vi.hoisted(() => ({
  handleStart: vi.fn(),
  handleUpdate: vi.fn(),
  handleEnd: vi.fn(),
  cancelActiveSessions: vi.fn(),
  getSnapshot: vi.fn()
}))

vi.mock('@asyra/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@asyra/core')>()),
  getSessionManager: () => ({
    handleStart: mocks.handleStart,
    handleUpdate: mocks.handleUpdate,
    handleEnd: mocks.handleEnd,
    cancelActiveSessions: mocks.cancelActiveSessions
  })
}))

vi.mock('../common-apis', () => ({
  systemContextApis: {
    getSystemContextSnapshot: mocks.getSnapshot
  }
}))

import {
  cancelLayerHierarchyMoveSession,
  endLayerHierarchyMoveSession,
  startLayerHierarchyMoveSession,
  updateLayerHierarchyMoveSession
} from './layer-move-session'

const pointerSession: LayerPointerSession = {
  phase: 'start',
  pointerId: 4,
  sourceElementId: 'a',
  startClientX: 0,
  startClientY: 0,
  clientX: 0,
  clientY: 0,
  dragActive: false,
  target: null
}
const source: LayerMoveSourcePlan = {
  elementIds: ['a'],
  sourceParentId: 'workspace',
  preSessionSelection: [],
  requestedSourceSelection: ['a'],
  replacesSelection: true
}
const dropIntent: ValidLayerDropIntent = {
  kind: 'valid',
  zone: 'workspace',
  targetElementId: null,
  expandGroupId: null,
  request: {
    elementIds: ['a'],
    targetParentId: 'workspace',
    targetIndex: 2
  }
}

describe('Layers hierarchy feature-session bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSnapshot.mockReturnValue({
      selectedElementIds: [],
      primaryTool: 'select'
    })
  })

  it('routes normalized start, update, and end through the public Core manager', async () => {
    mocks.handleStart.mockResolvedValue(true)
    const updatePointer = {
      ...pointerSession,
      phase: 'update' as const,
      dragActive: true
    }
    const endPointer = { ...updatePointer, phase: 'end' as const }

    await expect(
      startLayerHierarchyMoveSession(pointerSession, source)
    ).resolves.toBe(true)
    await updateLayerHierarchyMoveSession(updatePointer, dropIntent)
    await endLayerHierarchyMoveSession(endPointer, dropIntent)

    expect(mocks.handleStart).toHaveBeenCalledWith(
      InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
      expect.objectContaining({
        detail: {
          layerHierarchyMove: {
            phase: 'start',
            pointerSession,
            source
          }
        }
      })
    )
    expect(mocks.handleUpdate).toHaveBeenCalledWith(
      InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
      expect.objectContaining({
        detail: {
          layerHierarchyMove: {
            phase: 'update',
            pointerSession: updatePointer,
            dropIntent
          }
        }
      })
    )
    expect(mocks.handleEnd).toHaveBeenCalledWith(
      InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
      expect.objectContaining({
        detail: {
          layerHierarchyMove: {
            phase: 'end',
            pointerSession: endPointer,
            dropIntent
          }
        }
      })
    )
  })

  it('routes deterministic cleanup through commit-current cancellation', async () => {
    await cancelLayerHierarchyMoveSession('lost-capture')

    expect(mocks.cancelActiveSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          cancelled: true,
          cancelledBy: 'layer-hierarchy-move.lost-capture',
          layerHierarchyMoveCancellationReason: 'lost-capture'
        }
      })
    )
  })
})
