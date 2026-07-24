import { defineFeature } from '@asyra/core'
import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import { hierarchyApis, selectionApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type {
  LayerDropIntent,
  ValidLayerDropIntent
} from '../../controllers/layer-drop-intent'
import type { LayerHierarchyMoveDetail } from '../../controllers/layer-move-session'
import type { LayerMoveSourcePlan } from '../../controllers/layer-move-source'

export interface LayerHierarchyMoveState extends Record<string, unknown> {
  source: LayerMoveSourcePlan
}

const getDetail = (
  snapshot: SystemContextSnapshotWithDetail
): LayerHierarchyMoveDetail | null => {
  const value = snapshot.detail?.layerHierarchyMove
  if (!value || typeof value !== 'object' || !('phase' in value)) {
    return null
  }
  return value as LayerHierarchyMoveDetail
}

const idsEqual = (
  currentIds: readonly string[],
  nextIds: readonly string[]
): boolean =>
  currentIds.length === nextIds.length &&
  currentIds.every((elementId, index) => elementId === nextIds[index])

const isValidDropIntent = (
  value: LayerDropIntent | null
): value is ValidLayerDropIntent => value?.kind === 'valid'

export const layerHierarchyMoveSession = {
  onStart: (
    snapshot: SystemContextSnapshotWithDetail
  ): LayerHierarchyMoveState | null => {
    const detail = getDetail(snapshot)
    if (detail?.phase !== 'start') {
      return null
    }

    const requestedSelection = detail.source.requestedSourceSelection
    if (!idsEqual(selectionApis.getSelectedIds(), requestedSelection)) {
      selectionApis.selectElements([...requestedSelection])
    }
    return { source: detail.source }
  },
  onUpdate: (
    _snapshot: SystemContextSnapshotWithDetail,
    _state: LayerHierarchyMoveState
  ): void => undefined,
  onEnd: (
    snapshot: SystemContextSnapshotWithDetail,
    _state: LayerHierarchyMoveState
  ): void => {
    const detail = getDetail(snapshot)
    if (
      detail?.phase !== 'end' ||
      !detail.pointerSession.dragActive ||
      !isValidDropIntent(detail.dropIntent)
    ) {
      return
    }

    const result = hierarchyApis.moveElements(detail.dropIntent.request)
    selectionApis.selectElements([...result.elementIds])
  }
}

export const layerHierarchyMoveFeatureDefinition = {
  priority: 110,
  exclusive: true,
  cancelPolicy: 'commit-current' as const,
  session: layerHierarchyMoveSession
}

export const layerHierarchyMoveFeature = defineFeature<
  Record<string, unknown>,
  LayerHierarchyMoveState
>(
  FeatureNames.MOVE_LAYER_HIERARCHY,
  InputSystemEvents.INPUT_LAYER_HIERARCHY_MOVE,
  layerHierarchyMoveFeatureDefinition
)

export default layerHierarchyMoveFeature
