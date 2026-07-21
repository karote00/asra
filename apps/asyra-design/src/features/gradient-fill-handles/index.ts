import { defineFeature } from '@asyra/core'
import { isEqual } from 'lodash'
import type {
  FillAttrs,
  FillGradientData,
  FillGradientStop,
  PositionData,
  SystemContextSnapshot
} from '@asyra/utils'
import {
  cursorApis,
  elementApis,
  fillApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import type { GradientHandleGeometry } from '../../common-apis/fills'
import type {
  GradientHandleState,
  GradientStopState
} from '../../common-apis/system-context'
import {
  FEATURE_MOVEMENT_THRESHOLD,
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'

interface GradientHandleDragState extends Record<string, unknown> {
  elementId: string
  fillId: string
  handleIndex: 0 | 1
  dragStartWorkspacePos: PositionData
  initialGradient: FillGradientData
  latestGradient: FillGradientData
  currentFill: FillAttrs
  width: number
  height: number
  pendingWorkspacePos: PositionData | null
  rafId: number | null
  isDragging: boolean
  previousSelectedHandle: GradientHandleState | null
  previousHoveredHandle: GradientHandleState | null
}

interface GradientStopDragState extends Record<string, unknown> {
  elementId: string
  fillId: string
  stopIndex: number
  initialGradient: FillGradientData
  latestGradient: FillGradientData
  currentFill: FillAttrs
  geometry: GradientHandleGeometry
  canvasBounds: DOMRect | null
  pendingClientPos: PositionData | null
  rafId: number | null
  isDragging: boolean
  previousSelectedStop: GradientStopState | null
  previousHoveredStop: GradientStopState | null
}

const DRAG_EPSILON = 0.0001

const hasMovedBeyondWorkspaceThreshold = (
  start: PositionData,
  current: PositionData,
  threshold: number
) =>
  Math.abs(current.x - start.x) > threshold ||
  Math.abs(current.y - start.y) > threshold

const getEditableGradientFillState = (snapshot: SystemContextSnapshot) => {
  if (
    snapshot.primaryTool !== PrimaryToolType.SELECT ||
    systemContextApis.getPathEditingMode()
  ) {
    return null
  }

  const activeGradientFill = systemContextApis.getActiveGradientFill()
  if (!activeGradientFill) {
    return null
  }

  const selectedIds = selectionApis.getSelectedIds()
  if (
    selectedIds.length !== 1 ||
    selectedIds[0] !== activeGradientFill.elementId
  ) {
    return null
  }

  return activeGradientFill
}

const getHandleHitFromGeometry = (
  geometry: GradientHandleGeometry,
  clientPos: PositionData,
  hitRadius = 9
): { handleIndex: 0 | 1 } | null => {
  const canvasPos = fillApis.getCanvasPositionFromClient(clientPos)
  const hitRadiusSquared = hitRadius * hitRadius

  for (const [handleIndex, handlePos] of geometry.canvasHandles.entries()) {
    const dx = handlePos.x - canvasPos.x
    const dy = handlePos.y - canvasPos.y
    if (dx * dx + dy * dy <= hitRadiusSquared) {
      return {
        handleIndex: handleIndex as 0 | 1
      }
    }
  }

  return null
}

const getStopHitFromGeometry = (
  geometry: GradientHandleGeometry,
  clientPos: PositionData,
  hitSize = 16
): { stopIndex: number } | null => {
  if (!geometry.fill.gradient) {
    return null
  }

  const canvasPos = fillApis.getCanvasPositionFromClient(clientPos)
  const start = geometry.canvasHandles[0]
  const end = geometry.canvasHandles[1]

  const ldx = end.x - start.x
  const ldy = end.y - start.y
  const dist = Math.max(0.001, Math.sqrt(ldx * ldx + ldy * ldy))
  const ux = ldx / dist
  const uy = ldy / dist
  const px = -uy
  const py = ux

  const stopOffsetFromLine = 8
  const rectHalf = hitSize / 2
  const offsetDist = stopOffsetFromLine + rectHalf

  const stops = geometry.fill.gradient.gradientStops
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i]

    const lineX = start.x + (end.x - start.x) * stop.position
    const lineY = start.y + (end.y - start.y) * stop.position

    const cx = lineX + px * offsetDist
    const cy = lineY + py * offsetDist

    const relX = canvasPos.x - cx
    const relY = canvasPos.y - cy

    const localAlongLine = relX * ux + relY * uy
    const localPerpLine = relX * px + relY * py

    if (
      Math.abs(localAlongLine) <= rectHalf &&
      Math.abs(localPerpLine) <= rectHalf
    ) {
      return { stopIndex: i }
    }
  }

  return null
}

/**
 * Compute the stop position (0..1) from a client position projected onto
 * the gradient line in canvas space.
 */
const getStopPositionFromClientPos = (
  geometry: GradientHandleGeometry,
  clientPos: PositionData,
  canvasBounds: DOMRect | null
): number | null => {
  const canvasPos = fillApis.getCanvasPositionFromClient(
    clientPos,
    canvasBounds
  )
  const start = geometry.canvasHandles[0]
  const end = geometry.canvasHandles[1]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq < 0.001) {
    return 0
  }

  // Project the canvas position onto the gradient line
  const t =
    ((canvasPos.x - start.x) * dx + (canvasPos.y - start.y) * dy) / lengthSq
  return Math.max(0, Math.min(1, t))
}

const applyHandleDragUpdate = (
  state: GradientHandleDragState,
  workspacePos: PositionData
) => {
  const nextGradient = fillApis.getNextGradientForHandleWithDelta(
    state.initialGradient,
    state.handleIndex,
    state.width,
    state.height,
    {
      x: workspacePos.x - state.dragStartWorkspacePos.x,
      y: workspacePos.y - state.dragStartWorkspacePos.y
    }
  )

  const currentHandle = state.latestGradient.gradientHandles[state.handleIndex]
  const nextHandle = nextGradient.gradientHandles[state.handleIndex]
  if (
    currentHandle &&
    nextHandle &&
    Math.abs(currentHandle.x - nextHandle.x) <= DRAG_EPSILON &&
    Math.abs(currentHandle.y - nextHandle.y) <= DRAG_EPSILON
  ) {
    return
  }

  fillApis.updateFillField(
    state.elementId,
    state.fillId,
    state.currentFill,
    'gradient',
    nextGradient,
    { undoable: false, sharedDelivery: 'immediate' }
  )

  state.latestGradient = nextGradient
  state.currentFill = {
    ...state.currentFill,
    gradient: nextGradient
  }
  state.isDragging = true
}

const scheduleHandleDragUpdate = (
  state: GradientHandleDragState,
  workspacePos: PositionData
) => {
  state.pendingWorkspacePos = workspacePos
  if (state.rafId !== null) {
    return
  }

  state.rafId = requestAnimationFrame(() => {
    state.rafId = null
    const pending = state.pendingWorkspacePos
    state.pendingWorkspacePos = null
    if (!pending) {
      return
    }
    applyHandleDragUpdate(state, pending)
  })
}

const flushHandleDragUpdate = (state: GradientHandleDragState) => {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId)
    state.rafId = null
  }
  if (!state.pendingWorkspacePos) {
    return
  }
  const pending = state.pendingWorkspacePos
  state.pendingWorkspacePos = null
  applyHandleDragUpdate(state, pending)
}

const cancelHandleDragUpdate = (state: GradientHandleDragState) => {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId)
    state.rafId = null
  }
  state.pendingWorkspacePos = null
  systemContextApis.setSelectedGradientHandle(state.previousSelectedHandle)
  systemContextApis.setHoveredGradientHandle(state.previousHoveredHandle)
  cursorApis.resetCanvasCursor()
}

const applyStopDragUpdate = (
  state: GradientStopDragState,
  clientPos: PositionData
) => {
  const position = getStopPositionFromClientPos(
    state.geometry,
    clientPos,
    state.canvasBounds
  )
  if (position === null) {
    return
  }

  const currentStop = state.latestGradient.gradientStops[state.stopIndex]
  if (
    currentStop &&
    Math.abs(currentStop.position - position) <= DRAG_EPSILON
  ) {
    return
  }

  const nextStops: FillGradientStop[] = state.initialGradient.gradientStops.map(
    (stop: FillGradientStop, i: number) =>
      i === state.stopIndex ? { ...stop, position } : stop
  )

  const nextGradient: FillGradientData = {
    ...state.initialGradient,
    gradientStops: nextStops
  }

  fillApis.updateFillField(
    state.elementId,
    state.fillId,
    state.currentFill,
    'gradient',
    nextGradient,
    { undoable: false, sharedDelivery: 'immediate' }
  )

  state.latestGradient = nextGradient
  state.currentFill = {
    ...state.currentFill,
    gradient: nextGradient
  }
  state.isDragging = true
}

const scheduleStopDragUpdate = (
  state: GradientStopDragState,
  clientPos: PositionData
) => {
  state.pendingClientPos = clientPos
  if (state.rafId !== null) {
    return
  }

  state.rafId = requestAnimationFrame(() => {
    state.rafId = null
    const pending = state.pendingClientPos
    state.pendingClientPos = null
    if (!pending) {
      return
    }
    applyStopDragUpdate(state, pending)
  })
}

const flushStopDragUpdate = (state: GradientStopDragState) => {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId)
    state.rafId = null
  }
  if (!state.pendingClientPos) {
    return
  }
  const pending = state.pendingClientPos
  state.pendingClientPos = null
  applyStopDragUpdate(state, pending)
}

const cancelStopDragUpdate = (state: GradientStopDragState) => {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId)
    state.rafId = null
  }
  state.pendingClientPos = null
  systemContextApis.setSelectedGradientStop(state.previousSelectedStop)
  systemContextApis.setHoveredGradientStop(state.previousHoveredStop)
  cursorApis.resetCanvasCursor()
}

export const hoverGradientHandleFeature = defineFeature(
  FeatureNames.HOVER_GRADIENT_HANDLE,
  InputSystemEvents.INPUT_MOUSE_MOVE,
  {
    priority: 9,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      const activeGradientFill = getEditableGradientFillState(snapshot)
      if (!activeGradientFill) {
        systemContextApis.setHoveredGradientHandle(null)
        cursorApis.resetCanvasCursor()
        return null
      }

      const geometry = fillApis.getGradientHandleGeometry(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!geometry) {
        systemContextApis.setHoveredGradientHandle(null)
        cursorApis.resetCanvasCursor()
        return null
      }
      const hit = getHandleHitFromGeometry(geometry, snapshot.mousePosition)
      if (!hit) {
        systemContextApis.setHoveredGradientHandle(null)
        cursorApis.resetCanvasCursor()
        return null
      }

      systemContextApis.setHoveredGradientHandle({
        ...activeGradientFill,
        handleIndex: hit.handleIndex
      })
      cursorApis.setCanvasCursor('grab')

      return {
        ...activeGradientFill,
        handleIndex: hit.handleIndex
      }
    }
  }
)

export const hoverGradientStopFeature = defineFeature(
  FeatureNames.HOVER_GRADIENT_STOP,
  InputSystemEvents.INPUT_MOUSE_MOVE,
  {
    priority: 8,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      const activeGradientFill = getEditableGradientFillState(snapshot)
      if (!activeGradientFill) {
        return null
      }

      const geometry = fillApis.getGradientHandleGeometry(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!geometry) {
        systemContextApis.setHoveredGradientStop(null)
        return null
      }

      const hit = getStopHitFromGeometry(geometry, snapshot.mousePosition)
      if (!hit) {
        systemContextApis.setHoveredGradientStop(null)
        return null
      }

      systemContextApis.setHoveredGradientStop({
        ...activeGradientFill,
        stopIndex: hit.stopIndex
      })
      cursorApis.setCanvasCursor('grab')
      return { ...activeGradientFill, stopIndex: hit.stopIndex }
    }
  }
)

export const dragGradientHandleFeature = defineFeature<
  Record<string, unknown>,
  GradientHandleDragState
>(FeatureNames.DRAG_GRADIENT_HANDLE, InputSystemEvents.INPUT_DRAG, {
  priority: 16,
  exclusive: true,
  cancelPolicy: 'commit-current',
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const activeGradientFill = getEditableGradientFillState(snapshot)
      if (!activeGradientFill) {
        return null
      }

      const geometry = fillApis.getGradientHandleGeometry(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!geometry || !geometry.fill.gradient) {
        return null
      }

      const hoveredHandle = systemContextApis.getHoveredGradientHandle()
      const resolvedHandleIndex =
        hoveredHandle &&
        hoveredHandle.elementId === activeGradientFill.elementId &&
        hoveredHandle.fillId === activeGradientFill.fillId
          ? hoveredHandle.handleIndex
          : getHandleHitFromGeometry(geometry, snapshot.mousePosition)
              ?.handleIndex
      if (resolvedHandleIndex === undefined) {
        return null
      }

      const dragStartWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      if (!dragStartWorkspacePos) {
        return null
      }

      const previousSelectedHandle =
        systemContextApis.getSelectedGradientHandle()
      const previousHoveredHandle = systemContextApis.getHoveredGradientHandle()

      systemContextApis.setSelectedGradientHandle({
        ...activeGradientFill,
        handleIndex: resolvedHandleIndex
      })
      systemContextApis.setHoveredGradientHandle({
        ...activeGradientFill,
        handleIndex: resolvedHandleIndex
      })
      cursorApis.setCanvasCursor('grabbing')

      return {
        elementId: activeGradientFill.elementId,
        fillId: activeGradientFill.fillId,
        handleIndex: resolvedHandleIndex,
        dragStartWorkspacePos,
        initialGradient: geometry.fill.gradient,
        latestGradient: geometry.fill.gradient,
        currentFill: geometry.fill,
        width: geometry.width,
        height: geometry.height,
        pendingWorkspacePos: null,
        rafId: null,
        isDragging: false,
        previousSelectedHandle,
        previousHoveredHandle
      }
    },

    onUpdate: (
      snapshot: SystemContextSnapshot,
      state: GradientHandleDragState
    ) => {
      if (!snapshot.mouseDragging) {
        return
      }

      const currentWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      if (!currentWorkspacePos) {
        return
      }

      if (
        !state.isDragging &&
        !hasMovedBeyondWorkspaceThreshold(
          state.dragStartWorkspacePos,
          currentWorkspacePos,
          FEATURE_MOVEMENT_THRESHOLD.gradientHandle
        )
      ) {
        return
      }
      scheduleHandleDragUpdate(state, currentWorkspacePos)
    },

    onEnd: (
      _snapshot: SystemContextSnapshot,
      state: GradientHandleDragState
    ) => {
      flushHandleDragUpdate(state)
      cursorApis.setCanvasCursor('grab')

      if (!state.isDragging) {
        return
      }

      const currentFill = state.currentFill
      const finalGradient = state.latestGradient
      if (!currentFill?.gradient || !finalGradient) {
        return
      }

      if (isEqual(state.initialGradient, finalGradient)) {
        return
      }

      fillApis.updateFillField(
        state.elementId,
        state.fillId,
        currentFill,
        'gradient',
        state.initialGradient,
        { undoable: false }
      )
      fillApis.updateFillField(
        state.elementId,
        state.fillId,
        {
          ...currentFill,
          gradient: state.initialGradient
        },
        'gradient',
        finalGradient
      )
    },
    onCancel: (_snapshot, state): undefined => {
      cancelHandleDragUpdate(state)
    }
  }
})

export const dragGradientStopFeature = defineFeature<
  Record<string, unknown>,
  GradientStopDragState
>(FeatureNames.DRAG_GRADIENT_STOP, InputSystemEvents.INPUT_DRAG, {
  priority: 15,
  exclusive: true,
  cancelPolicy: 'commit-current',
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const activeGradientFill = getEditableGradientFillState(snapshot)
      if (!activeGradientFill) {
        return null
      }

      const geometry = fillApis.getGradientHandleGeometry(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!geometry || !geometry.fill.gradient) {
        return null
      }

      const hoveredStop = systemContextApis.getHoveredGradientStop()
      const resolvedStopIndex =
        hoveredStop &&
        hoveredStop.elementId === activeGradientFill.elementId &&
        hoveredStop.fillId === activeGradientFill.fillId
          ? hoveredStop.stopIndex
          : getStopHitFromGeometry(geometry, snapshot.mousePosition)?.stopIndex
      if (resolvedStopIndex === undefined) {
        return null
      }

      const previousSelectedStop = systemContextApis.getSelectedGradientStop()
      const previousHoveredStop = systemContextApis.getHoveredGradientStop()

      systemContextApis.setSelectedGradientStop({
        ...activeGradientFill,
        stopIndex: resolvedStopIndex
      })
      systemContextApis.setHoveredGradientStop({
        ...activeGradientFill,
        stopIndex: resolvedStopIndex
      })

      cursorApis.setCanvasCursor('grabbing')

      return {
        elementId: activeGradientFill.elementId,
        fillId: activeGradientFill.fillId,
        stopIndex: resolvedStopIndex,
        initialGradient: geometry.fill.gradient,
        latestGradient: geometry.fill.gradient,
        currentFill: geometry.fill,
        geometry,
        canvasBounds: fillApis.getCanvasBounds(),
        pendingClientPos: null,
        rafId: null,
        isDragging: false,
        previousSelectedStop,
        previousHoveredStop
      }
    },

    onUpdate: (
      snapshot: SystemContextSnapshot,
      state: GradientStopDragState
    ) => {
      if (!snapshot.mouseDragging) {
        return
      }

      const dragStart = snapshot.mouseDragStart
      if (
        !state.isDragging &&
        dragStart &&
        Math.abs(snapshot.mousePosition.x - dragStart.x) <=
          FEATURE_MOVEMENT_THRESHOLD.gradientStop &&
        Math.abs(snapshot.mousePosition.y - dragStart.y) <=
          FEATURE_MOVEMENT_THRESHOLD.gradientStop
      ) {
        return
      }

      scheduleStopDragUpdate(state, snapshot.mousePosition)
    },

    onEnd: (_snapshot: SystemContextSnapshot, state: GradientStopDragState) => {
      flushStopDragUpdate(state)
      cursorApis.setCanvasCursor('grab')

      if (!state.isDragging) {
        return
      }

      const currentFill = state.currentFill
      const finalGradient = state.latestGradient
      if (!currentFill?.gradient || !finalGradient) {
        return
      }

      if (isEqual(state.initialGradient, finalGradient)) {
        return
      }

      // Undo pattern: revert to initial, then apply final as undoable
      fillApis.updateFillField(
        state.elementId,
        state.fillId,
        currentFill,
        'gradient',
        state.initialGradient,
        { undoable: false }
      )
      fillApis.updateFillField(
        state.elementId,
        state.fillId,
        {
          ...currentFill,
          gradient: state.initialGradient
        },
        'gradient',
        finalGradient
      )
    },
    onCancel: (_snapshot, state): undefined => {
      cancelStopDragUpdate(state)
    }
  }
})
