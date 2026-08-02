import core from '../../contexts'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import {
  EventTypes,
  subscribeToEventBatches,
  type AllEvent
} from '@asyra/reactive-events'
import { elementApis } from '../../common-apis/element'
import {
  type VectorPointSelectionRef,
  type VectorSegmentSelectionRef,
  decodeVectorPointSelectionId,
  decodeVectorSegmentSelectionId
} from '../../common-apis/selection'
import type { SelectedVectorPointState } from '../../common-apis/system-context'

let hasInit = false

type SelectedVectorSegmentState = VectorSegmentSelectionRef &
  Record<string, unknown>

const computedEventUpdatesVectorPoints = (
  event: AllEvent,
  vectorId: string
): boolean => {
  if (
    (event.type !== EventTypes.UPDATE_COMPUTED_DATA &&
      event.type !== EventTypes.UPDATE_COMPUTED_DATA_PATCH) ||
    !('payload' in event) ||
    typeof event.payload !== 'object' ||
    event.payload === null ||
    !('id' in event.payload) ||
    event.payload.id !== vectorId
  ) {
    return false
  }
  const payload = event.payload as unknown as Record<string, unknown>
  if (payload.key === 'points') {
    return true
  }
  if (
    Array.isArray(payload.changes) &&
    payload.changes.some(
      (change) =>
        typeof change === 'object' &&
        change !== null &&
        'key' in change &&
        change.key === 'points'
    )
  ) {
    return true
  }
  const patch =
    typeof payload.patch === 'object' && payload.patch !== null
      ? (payload.patch as Record<string, unknown>)
      : undefined
  return (
    (typeof patch?.values === 'object' &&
      patch.values !== null &&
      Object.prototype.hasOwnProperty.call(patch.values, 'points')) ||
    (typeof patch?.records === 'object' &&
      patch.records !== null &&
      Object.prototype.hasOwnProperty.call(patch.records, 'points'))
  )
}

const toSelectedVectorPointState = (
  selectionIds: Set<string>,
  pathEditingVectorId: string | null
): SelectedVectorPointState | null => {
  const decodedSelections = [...selectionIds]
    .map((selectionId) => decodeVectorPointSelectionId(selectionId))
    .filter(
      (selection): selection is VectorPointSelectionRef => selection !== null
    )

  const selected =
    decodedSelections.find(
      (selection) =>
        !!pathEditingVectorId && selection.elementId === pathEditingVectorId
    ) ?? decodedSelections[0]

  if (!selected) {
    return null
  }

  const anchorPoint = elementApis.getVectorAnchorPointById(
    selected.elementId,
    selected.pointId
  )
  if (!anchorPoint) {
    return null
  }

  let targetPosition = anchorPoint.point.outHandle
  if (selected.target === 'inHandle') {
    targetPosition = anchorPoint.point.inHandle
  }
  if (selected.target === 'anchor') {
    targetPosition = { x: anchorPoint.point.x, y: anchorPoint.point.y }
  }

  if (!targetPosition) {
    return null
  }

  return {
    elementId: selected.elementId,
    pointId: selected.pointId,
    index: anchorPoint.index,
    target: selected.target,
    x: targetPosition.x,
    y: targetPosition.y,
    handleMode: elementApis.getVectorAnchorPointHandleMode(
      selected.elementId,
      selected.pointId
    )
  }
}

const toSelectedVectorSegmentState = (
  selectionIds: Set<string>,
  pathEditingVectorId: string | null
): SelectedVectorSegmentState | null => {
  const decodedSelections = [...selectionIds]
    .map((selectionId) => decodeVectorSegmentSelectionId(selectionId))
    .filter(
      (selection): selection is SelectedVectorSegmentState => selection !== null
    )

  return (
    decodedSelections.find(
      (selection) =>
        !!pathEditingVectorId && selection.elementId === pathEditingVectorId
    ) ??
    decodedSelections[0] ??
    null
  )
}

const syncDerivedVectorSelectionProperties = () => {
  const vectorPointSelection =
    core.getUIProperty<Set<string>>('vectorPointSelection') ?? new Set<string>()
  const vectorSegmentSelection =
    core.getUIProperty<Set<string>>('vectorSegmentSelection') ??
    new Set<string>()
  const pathEditingVectorId =
    core.getSystemProperty<string | null>(
      PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID
    ) ?? null

  core.setUIProperty(
    PresetSystemPropertyKeys.SELECTED_VECTOR_SEGMENT,
    toSelectedVectorSegmentState(vectorSegmentSelection, pathEditingVectorId)
  )
  core.setSystemProperty(
    PresetSystemPropertyKeys.SELECTED_VECTOR_SEGMENT,
    toSelectedVectorSegmentState(vectorSegmentSelection, pathEditingVectorId)
  )

  core.setSystemProperty(
    PresetSystemPropertyKeys.SELECTED_VECTOR_POINT,
    toSelectedVectorPointState(vectorPointSelection, pathEditingVectorId)
  )
}

export const initSelectionCompatibility = () => {
  if (hasInit) {
    return
  }

  core.onUIPropertyChange<Set<string>>('vectorPointSelection', () => {
    syncDerivedVectorSelectionProperties()
  })

  core.onUIPropertyChange<Set<string>>('vectorSegmentSelection', () => {
    syncDerivedVectorSelectionProperties()
  })

  const pathEditingVectorObservable = core.getSystemPropertyObservable<
    string | null
  >(PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID)
  pathEditingVectorObservable?.subscribe(() => {
    syncDerivedVectorSelectionProperties()
  })

  subscribeToEventBatches((events) => {
    const pathEditingVectorId =
      core.getSystemProperty<string | null>(
        PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID
      ) ?? null
    if (
      pathEditingVectorId &&
      events.some((event) =>
        computedEventUpdatesVectorPoints(event, pathEditingVectorId)
      )
    ) {
      syncDerivedVectorSelectionProperties()
    }
  })

  syncDerivedVectorSelectionProperties()
  hasInit = true
}
