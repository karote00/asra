import { getSessionManager } from '@asyra/core'
import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import { systemContextApis } from '../common-apis'
import { InputSystemEvents } from '../constants'
import type { LayerDropIntent } from './layer-drop-intent'
import type { ResolvedLayerMoveSource } from './layer-move-source'
import type {
  LayerPointerCancellationReason,
  LayerPointerSession
} from './layer-pointer-session'

export type LayerHierarchyMoveDetail =
  | {
      phase: 'start'
      pointerSession: LayerPointerSession
      source: ResolvedLayerMoveSource
    }
  | {
      phase: 'update' | 'end'
      pointerSession: LayerPointerSession
      dropIntent: LayerDropIntent | null
    }

const createSnapshot = (
  detail: Record<string, unknown>
): SystemContextSnapshotWithDetail => ({
  ...systemContextApis.getSystemContextSnapshot(),
  detail
})

export const startLayerHierarchyMoveSession = (
  pointerSession: LayerPointerSession,
  source: ResolvedLayerMoveSource
): Promise<boolean> =>
  getSessionManager().handleStart(
    InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
    createSnapshot({
      layerHierarchyMove: {
        phase: 'start',
        pointerSession,
        source
      } satisfies LayerHierarchyMoveDetail
    })
  )

export const updateLayerHierarchyMoveSession = (
  pointerSession: LayerPointerSession,
  dropIntent: LayerDropIntent | null
): Promise<void> =>
  getSessionManager().handleUpdate(
    InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
    createSnapshot({
      layerHierarchyMove: {
        phase: 'update',
        pointerSession,
        dropIntent
      } satisfies LayerHierarchyMoveDetail
    })
  )

export const endLayerHierarchyMoveSession = (
  pointerSession: LayerPointerSession,
  dropIntent: LayerDropIntent | null
): Promise<void> =>
  getSessionManager().handleEnd(
    InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
    createSnapshot({
      layerHierarchyMove: {
        phase: 'end',
        pointerSession,
        dropIntent
      } satisfies LayerHierarchyMoveDetail
    })
  )

export const cancelLayerHierarchyMoveSession = (
  reason: LayerPointerCancellationReason
): Promise<void> =>
  getSessionManager().cancelActiveSessions(
    createSnapshot({
      cancelled: true,
      cancelledBy: `layer-hierarchy-move.${reason}`,
      layerHierarchyMoveCancellationReason: reason
    })
  )
