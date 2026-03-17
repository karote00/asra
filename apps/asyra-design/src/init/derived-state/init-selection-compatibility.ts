import core from '../../contexts'
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

  const targetPosition =
    selected.target === 'anchor'
      ? { x: anchorPoint.point.x, y: anchorPoint.point.y }
      : selected.target === 'inHandle'
        ? anchorPoint.point.inHandle
        : anchorPoint.point.outHandle

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
    core.getSystemProperty<string | null>('pathEditingVectorId') ?? null

  core.setUIProperty(
    'selectedVectorSegment',
    toSelectedVectorSegmentState(vectorSegmentSelection, pathEditingVectorId)
  )
  core.setSystemProperty(
    'selectedVectorSegment',
    toSelectedVectorSegmentState(vectorSegmentSelection, pathEditingVectorId)
  )

  core.setSystemProperty(
    'selectedVectorPoint',
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
  >('pathEditingVectorId')
  pathEditingVectorObservable?.subscribe(() => {
    syncDerivedVectorSelectionProperties()
  })

  syncDerivedVectorSelectionProperties()
  hasInit = true
}
