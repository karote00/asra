import { defineFeature } from '@asyra/core'
import { isEqual } from 'lodash'
import type {
  FillGradientData,
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
