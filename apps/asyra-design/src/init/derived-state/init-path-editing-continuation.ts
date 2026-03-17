import {
  subscribeToChangeComputedData,
  subscribeToUpdateComputedData
} from '@asyra/reactive-events'
import { VECTOR_TOKENS } from '@asyra/core'
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
    'selectedVectorPoint'
  )
  const subpaths = elementApis.getVectorAnchorSubpaths(vectorId)

  if (subpaths.length === 0) {
    return null
  }

  let targetPointId: string | null = null

  // 1. Try currently selected point if it's an endpoint
  if (
    selectedPoint &&
    selectedPoint.elementId === vectorId &&
    selectedPoint.target === VECTOR_TOKENS.POINT.TARGET.ANCHOR
  ) {
    const pointId = selectedPoint.pointId
    const isEndpoint = subpaths.some((subpath) => {
      if (subpath.length === 0) return false
      const first = subpath[0]
      const last = subpath[subpath.length - 1]
      // In a closed subpath, first === last, but both are considered endpoints for continuation?
      // Actually usually closed subpaths don't have endpoints.
      return first.id === pointId || last.id === pointId
    })

    if (isEndpoint) {
      targetPointId = pointId
    }
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

  const continuation = elementApis.getVectorAnchorEndpoint(
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
  const vectorId = core.getSystemProperty<string | null>('pathEditingVectorId')
  const startNewSubpath =
    core.getSystemProperty<boolean>('pathEditingStartNewSubpath') ?? false

  if (!vectorId) {
    core.setSystemProperty('pathEditingContinuation', null)
    return
  }

  const nextContinuation = calculateContinuation(vectorId, startNewSubpath)
  const currentContinuation =
    core.getSystemProperty<PathEditingContinuationState | null>(
      'pathEditingContinuation'
    )

  // Simple shallow check for change
  if (
    nextContinuation?.pointId !== currentContinuation?.pointId ||
    nextContinuation?.side !== currentContinuation?.side ||
    nextContinuation?.elementId !== currentContinuation?.elementId
  ) {
    core.setSystemProperty('pathEditingContinuation', nextContinuation)
  }
}

export const initPathEditingContinuation = () => {
  // Sync on path editing state changes
  core
    .getSystemPropertyObservable<string | null>('pathEditingVectorId')
    ?.subscribe(() => syncContinuation())
  core
    .getSystemPropertyObservable<boolean>('pathEditingStartNewSubpath')
    ?.subscribe(() => syncContinuation())

  // Sync on selection changes (specifically vector points)
  core.onUIPropertyChange('vectorPointSelection', () => syncContinuation())

  // Sync on topology changes
  subscribeToUpdateComputedData((event) => {
    if (VECTOR_TOPOLOGY_KEYS.has(event.payload.key)) {
      const vectorId = core.getSystemProperty<string | null>(
        'pathEditingVectorId'
      )
      if (event.payload.id === vectorId) {
        syncContinuation()
      }
    }
  })

  subscribeToChangeComputedData((event) => {
    if (VECTOR_TOPOLOGY_KEYS.has(event.payload.key)) {
      const vectorId = core.getSystemProperty<string | null>(
        'pathEditingVectorId'
      )
      if (vectorId && event.payload.elementIds.includes(vectorId)) {
        syncContinuation()
      }
    }
  })

  syncContinuation()
}
