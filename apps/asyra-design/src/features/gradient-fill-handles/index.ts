import { defineFeature } from '@asyra/core'
import { isEqual } from 'lodash'
import type {
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
import {
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
  isDragging: boolean
}

interface GradientStopDragState extends Record<string, unknown> {
  elementId: string
  fillId: string
  stopIndex: number
  initialGradient: FillGradientData
  latestGradient: FillGradientData
  isDragging: boolean
}

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

  const fill = fillApis.getFillById(
    activeGradientFill.elementId,
    activeGradientFill.fillId
  )
  if (!fill?.gradient) {
    return null
  }

  return activeGradientFill
}

/**
 * Compute the stop position (0..1) from a client position projected onto
 * the gradient line in canvas space.
 */
const getStopPositionFromClientPos = (
  elementId: string,
  fillId: string,
  clientPos: PositionData
): number | null => {
  const geometry = fillApis.getGradientHandleGeometry(elementId, fillId)
  if (!geometry) {
    return null
  }

  const canvasBounds = document.querySelector('canvas')?.getBoundingClientRect()
  const canvasPos = {
    x: clientPos.x - (canvasBounds?.left ?? 0),
    y: clientPos.y - (canvasBounds?.top ?? 0)
  }

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

      const hit = fillApis.getGradientHandleHitAtClientPos(
        activeGradientFill.elementId,
        activeGradientFill.fillId,
        snapshot.mousePosition
      )
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

      const hit = fillApis.getGradientStopHitAtClientPos(
        activeGradientFill.elementId,
        activeGradientFill.fillId,
        snapshot.mousePosition
      )
      if (!hit) {
        return null
      }

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
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const activeGradientFill = getEditableGradientFillState(snapshot)
      if (!activeGradientFill) {
        return null
      }

      const hit = fillApis.getGradientHandleHitAtClientPos(
        activeGradientFill.elementId,
        activeGradientFill.fillId,
        snapshot.mousePosition
      )
      if (!hit) {
        return null
      }

      const fill = fillApis.getFillById(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!fill?.gradient) {
        return null
      }

      const dragStartWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      if (!dragStartWorkspacePos) {
        return null
      }

      systemContextApis.setSelectedGradientHandle({
        ...activeGradientFill,
        handleIndex: hit.handleIndex
      })
      systemContextApis.setHoveredGradientHandle({
        ...activeGradientFill,
        handleIndex: hit.handleIndex
      })
      cursorApis.setCanvasCursor('grabbing')

      return {
        elementId: activeGradientFill.elementId,
        fillId: activeGradientFill.fillId,
        handleIndex: hit.handleIndex,
        dragStartWorkspacePos,
        initialGradient: fill.gradient,
        latestGradient: fill.gradient,
        isDragging: false
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

      const nextGradient = fillApis.updateGradientHandleWithWorkspaceDelta(
        state.elementId,
        state.fillId,
        state.handleIndex,
        state.initialGradient,
        {
          x: currentWorkspacePos.x - state.dragStartWorkspacePos.x,
          y: currentWorkspacePos.y - state.dragStartWorkspacePos.y
        },
        { undoable: false }
      )
      if (!nextGradient || isEqual(state.initialGradient, nextGradient)) {
        return
      }

      state.latestGradient = nextGradient
      state.isDragging = true
    },

    onEnd: (
      snapshot: SystemContextSnapshot,
      state: GradientHandleDragState
    ) => {
      cursorApis.setCanvasCursor('grab')

      if (!state.isDragging) {
        return
      }

      const currentFill = fillApis.getFillById(state.elementId, state.fillId)
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
    }
  }
})

export const dragGradientStopFeature = defineFeature<
  Record<string, unknown>,
  GradientStopDragState
>(FeatureNames.DRAG_GRADIENT_STOP, InputSystemEvents.INPUT_DRAG, {
  priority: 15,
  exclusive: true,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const activeGradientFill = getEditableGradientFillState(snapshot)
      if (!activeGradientFill) {
        return null
      }

      const hit = fillApis.getGradientStopHitAtClientPos(
        activeGradientFill.elementId,
        activeGradientFill.fillId,
        snapshot.mousePosition
      )
      if (!hit) {
        return null
      }

      const fill = fillApis.getFillById(
        activeGradientFill.elementId,
        activeGradientFill.fillId
      )
      if (!fill?.gradient) {
        return null
      }

      cursorApis.setCanvasCursor('grabbing')

      return {
        elementId: activeGradientFill.elementId,
        fillId: activeGradientFill.fillId,
        stopIndex: hit.stopIndex,
        initialGradient: fill.gradient,
        latestGradient: fill.gradient,
        isDragging: false
      }
    },

    onUpdate: (
      snapshot: SystemContextSnapshot,
      state: GradientStopDragState
    ) => {
      if (!snapshot.mouseDragging) {
        return
      }

      const position = getStopPositionFromClientPos(
        state.elementId,
        state.fillId,
        snapshot.mousePosition
      )
      if (position === null) {
        return
      }

      const nextStops: FillGradientStop[] =
        state.initialGradient.gradientStops.map(
          (stop: FillGradientStop, i: number) =>
            i === state.stopIndex ? { ...stop, position } : stop
        )

      const nextGradient: FillGradientData = {
        ...state.initialGradient,
        gradientStops: nextStops
      }

      const currentFill = fillApis.getFillById(state.elementId, state.fillId)
      if (!currentFill) {
        return
      }

      fillApis.updateFillField(
        state.elementId,
        state.fillId,
        currentFill,
        'gradient',
        nextGradient,
        { undoable: false }
      )

      state.latestGradient = nextGradient
      state.isDragging = true
    },

    onEnd: (
      snapshot: SystemContextSnapshot,
      state: GradientStopDragState
    ) => {
      cursorApis.setCanvasCursor('grab')

      if (!state.isDragging) {
        return
      }

      const currentFill = fillApis.getFillById(state.elementId, state.fillId)
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
    }
  }
})
