import type { PositionData, SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/core'
import {
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import {
  FEATURE_MOVEMENT_THRESHOLD,
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'

interface MoveElementsState {
  dragStartWorkspacePos: PositionData
  initialPositions: Record<string, PositionData>
  isMoving: boolean
  [key: string]: unknown
}

interface MoveElementsApi {
  resolveInitialPositions: (snapshot: SystemContextSnapshot) => {
    dragStartWorkspacePos: PositionData
    initialPositions: Record<string, PositionData>
  } | null
  hasMovedBeyondThreshold: (snapshot: SystemContextSnapshot) => boolean
  calculateTargetPositions: (
    dragStartWorkspacePos: PositionData,
    currentWorkspacePos: PositionData,
    initialPositions: Record<string, PositionData>
  ) => Record<string, PositionData>
  applyPositions: (
    positionsById: Record<string, PositionData>,
    options?: { undoable: boolean }
  ) => void
  [key: string]: unknown
}

const api: MoveElementsApi = {
  resolveInitialPositions: (snapshot: SystemContextSnapshot) => {
    if (snapshot.primaryTool !== PrimaryToolType.SELECT || snapshot.keyShift) {
      return null
    }

    if (systemContextApis.getPathEditingMode()) {
      return null
    }

    const hoveredElementId =
      elementApis.getElementIdAtClientPos(snapshot.mousePosition) ??
      snapshot.hoveredElementId
    if (!hoveredElementId) {
      return null
    }

    if (elementApis.isElementLocked(hoveredElementId)) {
      return null
    }

    let selectedElementIds = selectionApis.getSelectedIds()
    if (!selectedElementIds.includes(hoveredElementId)) {
      selectionApis.selectElements([hoveredElementId])
      selectedElementIds = [hoveredElementId]
    }

    const dragStartWorkspacePos = elementApis.getMousePosInWorkspace(
      snapshot.mousePosition
    )
    if (!dragStartWorkspacePos) {
      return null
    }

    const initialPositions = selectedElementIds.reduce<
      Record<string, PositionData>
    >((acc, elementId) => {
      if (elementApis.isElementLocked(elementId)) {
        return acc
      }

      const position = elementApis.getElementPosition(elementId)
      if (!position) {
        return acc
      }

      acc[elementId] = position
      return acc
    }, {})

    if (Object.keys(initialPositions).length === 0) {
      return null
    }

    return {
      dragStartWorkspacePos,
      initialPositions
    }
  },

  hasMovedBeyondThreshold: (snapshot: SystemContextSnapshot) => {
    const dragStart = snapshot.mouseDragStart ?? snapshot.mousePosition
    return elementApis.hasMovedBeyondThreshold(
      dragStart,
      snapshot.mousePosition,
      FEATURE_MOVEMENT_THRESHOLD.moveElement
    )
  },

  calculateTargetPositions: (
    dragStartWorkspacePos: PositionData,
    currentWorkspacePos: PositionData,
    initialPositions: Record<string, PositionData>
  ) => {
    const dx = currentWorkspacePos.x - dragStartWorkspacePos.x
    const dy = currentWorkspacePos.y - dragStartWorkspacePos.y

    return Object.entries(initialPositions).reduce<
      Record<string, PositionData>
    >((acc, [elementId, startPos]) => {
      acc[elementId] = {
        x: startPos.x + dx,
        y: startPos.y + dy
      }
      return acc
    }, {})
  },

  applyPositions: (
    positionsById: Record<string, PositionData>,
    options?: { undoable: boolean }
  ) => {
    elementApis.setElementPositions(positionsById, options)
  }
}

export const moveElementsFeature = defineFeature<
  MoveElementsApi,
  MoveElementsState
>(FeatureNames.MOVE_ELEMENTS, InputSystemEvents.INPUT_DRAG, {
  priority: 8,
  exclusive: true,
  api,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const initialState = api.resolveInitialPositions(snapshot)
      if (!initialState) {
        return null
      }

      return {
        ...initialState,
        isMoving: false
      }
    },

    onUpdate: (snapshot: SystemContextSnapshot, state: MoveElementsState) => {
      if (!snapshot.mouseDragging || !api.hasMovedBeyondThreshold(snapshot)) {
        return
      }

      const currentWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      if (!currentWorkspacePos) {
        return
      }

      const targetPositions = api.calculateTargetPositions(
        state.dragStartWorkspacePos,
        currentWorkspacePos,
        state.initialPositions
      )

      api.applyPositions(targetPositions, { undoable: false })
      state.isMoving = true
    },

    onEnd: (snapshot: SystemContextSnapshot, state: MoveElementsState) => {
      if (!state.isMoving) {
        return
      }

      const currentWorkspacePos = elementApis.getMousePosInWorkspace(
        snapshot.mousePosition
      )
      if (!currentWorkspacePos) {
        return
      }

      const targetPositions = api.calculateTargetPositions(
        state.dragStartWorkspacePos,
        currentWorkspacePos,
        state.initialPositions
      )

      api.applyPositions(state.initialPositions, { undoable: false })
      api.applyPositions(targetPositions)
    }
  }
})

export default moveElementsFeature
