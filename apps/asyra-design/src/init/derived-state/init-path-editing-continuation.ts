import {
  subscribeToChangeComputedData,
  subscribeToUpdateComputedData
} from '@asyra/reactive-events'
import { VECTOR_TOKENS } from '@asyra/core'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import core from '../../contexts'
import { elementApis } from '../../common-apis'
import type {
  PathEditingContinuationState,
  SelectedVectorPointState
} from '../../common-apis/system-context'

const VECTOR_TOPOLOGY_KEYS = new Set(['points', 'segments', 'networks'])

const calculateContinuation = (
  vectorId: string,
  startNewSubpath: boolean
): PathEditingContinuationState | null => {
  if (startNewSubpath) {
    return null
  }

  const selectedPoint = core.getSystemProperty<SelectedVectorPointState | null>(
    PresetSystemPropertyKeys.SELECTED_VECTOR_POINT
  )
  const subpaths = elementApis.getVectorAnchorSubpaths(vectorId)

  if (subpaths.length === 0) {
    return null
  }

  let targetPointId: string | null = null

  // 1. Try currently selected point. Pen continuation can branch from any
  // anchor; endpoint-only merge/close remains a topology adapter detail.
  if (
    selectedPoint &&
    selectedPoint.elementId === vectorId &&
    selectedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
  ) {
    targetPointId = selectedPoint.pointId
  }

  // 2. Fallback to last point of last subpath
  if (!targetPointId) {
    const lastSubpath = subpaths[subpaths.length - 1]
    if (lastSubpath && lastSubpath.length > 0) {
      targetPointId = lastSubpath[lastSubpath.length - 1].id
    }
  }

  if (!targetPointId) {
    return null
  }

  const continuation = elementApis.getVectorAnchorContinuation(
    vectorId,
    targetPointId
  )
  if (!continuation) {
    return null
  }

  return {
    ...continuation,
    elementId: vectorId
  }
}

const syncContinuation = () => {
  const vectorId = core.getSystemProperty<string | null>(
    PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID
  )
  const startNewSubpath =
    core.getSystemProperty<boolean>(
      PresetSystemPropertyKeys.PATH_EDITING_START_NEW_SUBPATH
    ) ?? false

  if (!vectorId) {
    core.setSystemProperty(
      PresetSystemPropertyKeys.PATH_EDITING_CONTINUATION,
      null
    )
    return
  }

  const nextContinuation = calculateContinuation(vectorId, startNewSubpath)
  const currentContinuation =
    core.getSystemProperty<PathEditingContinuationState | null>(
      PresetSystemPropertyKeys.PATH_EDITING_CONTINUATION
    )

  // Simple shallow check for change
  if (
    nextContinuation?.pointId !== currentContinuation?.pointId ||
    nextContinuation?.side !== currentContinuation?.side ||
    nextContinuation?.networkId !== currentContinuation?.networkId ||
    nextContinuation?.elementId !== currentContinuation?.elementId
  ) {
    core.setSystemProperty(
      PresetSystemPropertyKeys.PATH_EDITING_CONTINUATION,
      nextContinuation
    )
  }
}

export const initPathEditingContinuation = () => {
  // Sync on path editing state changes
  core
    .getSystemPropertyObservable<
      string | null
    >(PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID)
    ?.subscribe(() => syncContinuation())
  core
    .getSystemPropertyObservable<boolean>(
      PresetSystemPropertyKeys.PATH_EDITING_START_NEW_SUBPATH
    )
    ?.subscribe(() => syncContinuation())

  // Sync on selection changes (specifically vector points)
  core.onUIPropertyChange('vectorPointSelection', () => syncContinuation())

  // Sync on topology changes
  subscribeToUpdateComputedData((event) => {
    if (VECTOR_TOPOLOGY_KEYS.has(event.payload.key)) {
      const vectorId = core.getSystemProperty<string | null>(
        PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID
      )
      if (event.payload.id === vectorId) {
        syncContinuation()
      }
    }
  })

  subscribeToChangeComputedData((event) => {
    if (VECTOR_TOPOLOGY_KEYS.has(event.payload.key)) {
      const vectorId = core.getSystemProperty<string | null>(
        PresetSystemPropertyKeys.PATH_EDITING_VECTOR_ID
      )
      if (vectorId && event.payload.elementIds.includes(vectorId)) {
        syncContinuation()
      }
    }
  })

  syncContinuation()
}
