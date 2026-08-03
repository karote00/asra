import {
  type EVENT_OPTIONS,
  type PositionData,
  type Rect,
  type SystemContextSnapshot,
  measureBrowserDragPhase
} from '@asyra/utils'
import { defineFeature } from '@asyra/core'
import {
  elementApis,
  selectionApis,
  systemContextApis,
  transactionApis
} from '../../common-apis'
import {
  FEATURE_MOVEMENT_THRESHOLD,
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'
import { resolveCanvasHierarchyTargetAtClientPos } from '../../controllers/canvas-hierarchy-target'

interface MoveElementsState {
  dragStartWorkspacePos: PositionData
  initialPositions: Record<string, PositionData>
  latestPositions: Record<string, PositionData> | null
  isMoving: boolean
  startedFromSelectionBounds: boolean
  [key: string]: unknown
}

interface MoveElementsApi {
  resolveInitialPositions: (snapshot: SystemContextSnapshot) => {
    dragStartWorkspacePos: PositionData
    initialPositions: Record<string, PositionData>
    startedFromSelectionBounds: boolean
  } | null
  hasMovedBeyondThreshold: (snapshot: SystemContextSnapshot) => boolean
  calculateTargetPositions: (
    dragStartWorkspacePos: PositionData,
    currentWorkspacePos: PositionData,
    initialPositions: Record<string, PositionData>
  ) => Record<string, PositionData>
  applyPositions: (
    positionsById: Record<string, PositionData>,
    options?: EVENT_OPTIONS
  ) => void
  [key: string]: unknown
}

const isPointInsideBounds = (point: PositionData, bounds: Rect): boolean => {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}

const getSelectionClientBounds = (elementIds: string[]): Rect | null => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  elementIds.forEach((elementId) => {
    if (elementApis.isElementLocked(elementId)) {
      return
    }

    const bounds = elementApis.getElementClientBounds(elementId)
    if (!bounds) {
      return
    }

    minX = Math.min(minX, bounds.x)
    minY = Math.min(minY, bounds.y)
    maxX = Math.max(maxX, bounds.x + bounds.width)
    maxY = Math.max(maxY, bounds.y + bounds.height)
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

const resolveInitialPositions = (
  dragStartWorkspacePos: PositionData,
  selectedElementIds: string[]
): {
  dragStartWorkspacePos: PositionData
  initialPositions: Record<string, PositionData>
} | null => {
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
}

const api: MoveElementsApi = {
  resolveInitialPositions: (snapshot: SystemContextSnapshot) => {
    if (snapshot.primaryTool !== PrimaryToolType.SELECT || snapshot.keyShift) {
      return null
    }

    if (systemContextApis.getPathEditingMode()) {
      return null
    }

    const dragStartClientPos = snapshot.mouseDragStart ?? snapshot.mousePosition
    const dragStartWorkspacePos =
      elementApis.getMousePosInWorkspace(dragStartClientPos)
    if (!dragStartWorkspacePos) {
      return null
    }

    const selectedElementIds = selectionApis.getSelectedIds()
    if (selectedElementIds.length > 0) {
      const selectionBounds = getSelectionClientBounds(selectedElementIds)
      if (
        selectionBounds &&
        isPointInsideBounds(dragStartClientPos, selectionBounds)
      ) {
        const selectionInitial = resolveInitialPositions(
          dragStartWorkspacePos,
          selectedElementIds
        )
        if (selectionInitial) {
          return {
            ...selectionInitial,
            startedFromSelectionBounds: true
          }
        }
      }
    }

    const hoveredElementId = resolveCanvasHierarchyTargetAtClientPos(snapshot)
    if (!hoveredElementId) {
      return null
    }

    if (elementApis.isElementLocked(hoveredElementId)) {
      return null
    }

    let hoveredSelectionIds = selectedElementIds
    if (!hoveredSelectionIds.includes(hoveredElementId)) {
      selectionApis.selectElements([hoveredElementId], {
        undoable: false
      })
      hoveredSelectionIds = [hoveredElementId]
    }

    const hoveredInitial = resolveInitialPositions(
      dragStartWorkspacePos,
      hoveredSelectionIds
    )
    if (!hoveredInitial) {
      return null
    }

    return {
      ...hoveredInitial,
      startedFromSelectionBounds: false
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
    options?: EVENT_OPTIONS
  ) => {
    elementApis.setElementPositions(positionsById, options)
  }
}

const positionsMatch = (
  left: Record<string, PositionData>,
  right: Record<string, PositionData>
): boolean => {
  const leftEntries = Object.entries(left)
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(
      ([elementId, position]) =>
        right[elementId]?.x === position.x && right[elementId]?.y === position.y
    )
  )
}

export const moveElementsSession = {
  onStart: (snapshot: SystemContextSnapshot) => {
    const initialState = api.resolveInitialPositions(snapshot)
    if (!initialState) {
      return null
    }

    return {
      ...initialState,
      latestPositions: null,
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

    measureBrowserDragPhase('move-elements:apply-positions', () =>
      api.applyPositions(targetPositions, {
        undoable: false,
        sharedDelivery: 'immediate'
      })
    )
    state.latestPositions = targetPositions
    state.isMoving = true
  },

  onEnd: (snapshot: SystemContextSnapshot, state: MoveElementsState) => {
    if (!state.isMoving) {
      if (!state.startedFromSelectionBounds) {
        return
      }

      const hoveredElementId = resolveCanvasHierarchyTargetAtClientPos(snapshot)
      const hoveredSelectionId =
        hoveredElementId &&
        !elementApis.isElementLocked(hoveredElementId) &&
        elementApis.isElementVisible(hoveredElementId)
          ? hoveredElementId
          : null

      const nextSelectionIds = hoveredSelectionId ? [hoveredSelectionId] : []
      const currentSelectionIds = selectionApis.getSelectedIds()

      if (
        nextSelectionIds.length === currentSelectionIds.length &&
        nextSelectionIds.every((id) => currentSelectionIds.includes(id))
      ) {
        return
      }

      transactionApis.runTransaction(() => {
        selectionApis.selectElements(nextSelectionIds)
      })

      return
    }

    const options = {
      undoable: false,
      sharedDelivery: 'immediate'
    } as const
    const currentWorkspacePos = elementApis.getMousePosInWorkspace(
      snapshot.mousePosition
    )
    if (currentWorkspacePos) {
      const targetPositions = api.calculateTargetPositions(
        state.dragStartWorkspacePos,
        currentWorkspacePos,
        state.initialPositions
      )

      if (
        !state.latestPositions ||
        !positionsMatch(targetPositions, state.latestPositions)
      ) {
        api.applyPositions(targetPositions, options)
        state.latestPositions = targetPositions
      }
    }

    elementApis.normalizeGroupGeometryForElements(
      Object.keys(state.initialPositions),
      options
    )
  },
  onCancel: () => undefined
}

export const moveElementsFeature = defineFeature<
  MoveElementsApi,
  MoveElementsState
>(FeatureNames.MOVE_ELEMENTS, InputSystemEvents.INPUT_DRAG, {
  priority: 8,
  exclusive: true,
  cancelPolicy: 'commit-current',
  api,
  session: moveElementsSession
})

export default moveElementsFeature
