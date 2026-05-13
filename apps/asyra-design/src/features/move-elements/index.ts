import type { PositionData, SystemContextSnapshot } from '@asyra/utils'
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

interface MoveElementsState {
  dragStartWorkspacePos: PositionData
  initialPositions: Record<string, PositionData>
  isMoving: boolean
  startedFromSelectionBounds: boolean
  [key: string]: unknown
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

const measureBrowserDragPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
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
    options?: { undoable: boolean }
  ) => void
  [key: string]: unknown
}

const getSelectionBounds = (elementIds: string[]): Bounds | null => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  elementIds.forEach((elementId) => {
    if (elementApis.isElementLocked(elementId)) {
      return
    }

    const bounds = elementApis.getElementBounds(elementId)
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

const isPointInsideBounds = (point: PositionData, bounds: Bounds): boolean => {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
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

    const dragStartWorkspacePos = elementApis.getMousePosInWorkspace(
      snapshot.mousePosition
    )
    if (!dragStartWorkspacePos) {
      return null
    }

    const selectedElementIds = selectionApis.getSelectedIds()
    if (selectedElementIds.length > 0) {
      const selectionBounds = getSelectionBounds(selectedElementIds)
      if (
        selectionBounds &&
        isPointInsideBounds(dragStartWorkspacePos, selectionBounds)
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

    const hoveredElementId =
      snapshot.hoveredElementId ??
      elementApis.getElementIdAtClientPos(snapshot.mousePosition)
    if (!hoveredElementId) {
      return null
    }

    if (elementApis.isElementLocked(hoveredElementId)) {
      return null
    }

    let hoveredSelectionIds = selectedElementIds
    if (!hoveredSelectionIds.includes(hoveredElementId)) {
      selectionApis.selectElements([hoveredElementId])
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

      measureBrowserDragPhase('move-elements:apply-positions', () =>
        api.applyPositions(targetPositions, { undoable: false })
      )
      state.isMoving = true
    },

    onEnd: (snapshot: SystemContextSnapshot, state: MoveElementsState) => {
      if (!state.isMoving) {
        if (!state.startedFromSelectionBounds) {
          return
        }

        const hoveredElementId =
          snapshot.hoveredElementId ??
          elementApis.getElementIdAtClientPos(snapshot.mousePosition)
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

        transactionApis.startTransaction()
        try {
          selectionApis.selectElements(nextSelectionIds)
        } finally {
          transactionApis.endTransaction()
        }

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
