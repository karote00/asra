import { id, type SystemContextSnapshot } from '@asyra/utils'
import { VECTOR_ANCHOR_ID_TYPE, type VectorAnchorPoint } from '@asyra/core'
import { defineFeature } from '@asyra/feature-system'
import {
  cursorApis,
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import { PrimaryToolType, InputSystemEvents } from '../../constants'

interface PenState {
  elementId: string
}

const createAnchorPoint = (
  point: { x: number; y: number },
  options?: { isMove?: boolean }
): VectorAnchorPoint => ({
  id: id(VECTOR_ANCHOR_ID_TYPE),
  x: point.x,
  y: point.y,
  type: 'sharp',
  isMove: options?.isMove,
  inHandle: null,
  outHandle: null
})

const getCurrentSubpathStartIndex = (anchorPoints: VectorAnchorPoint[]) => {
  for (let i = anchorPoints.length - 1; i >= 0; i -= 1) {
    if (anchorPoints[i].isMove) {
      return i
    }
  }

  return 0
}

const DOUBLE_CLICK_HIT_PADDING = 8

const isPathEditingVectorSelected = (
  selectedIds: string[],
  pathEditingVectorId: string | null
): pathEditingVectorId is string => {
  if (!pathEditingVectorId || selectedIds.length !== 1) {
    return false
  }

  if (selectedIds[0] !== pathEditingVectorId) {
    return false
  }

  return elementApis.getElementType(pathEditingVectorId) === 'vector'
}

export const penFeature = defineFeature('pen', 'input.drag', {
  priority: 15,
  exclusive: true,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      if (snapshot.primaryTool !== PrimaryToolType.PEN) {
        return null
      }

      const dragStartWorkspace = elementApis.getMousePosInWorkspace({
        x: snapshot.mouse.position.x,
        y: snapshot.mouse.position.y
      })

      if (!dragStartWorkspace) {
        return null
      }

      const selectedIds = selectionApis.getSelectedIds()
      const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
      const startNewSubpath =
        systemContextApis.getPathEditingStartNewSubpath()

      if (isPathEditingVectorSelected(selectedIds, pathEditingVectorId)) {
        const newPoint = createAnchorPoint(dragStartWorkspace, {
          isMove: startNewSubpath
        })
        const selectedPoint = elementApis.appendVectorAnchorPoint(
          pathEditingVectorId,
          newPoint
        )
        selectionApis.selectElements([pathEditingVectorId])
        if (selectedPoint) {
          systemContextApis.setSelectedVectorPoint({
            elementId: pathEditingVectorId,
            pointId: selectedPoint.point.id,
            index: selectedPoint.index,
            x: selectedPoint.point.x,
            y: selectedPoint.point.y
          })
        } else {
          systemContextApis.setSelectedVectorPoint(null)
        }
        if (startNewSubpath) {
          systemContextApis.setPathEditingStartNewSubpath(false)
        }
        systemContextApis.setHoveredVectorPoint(null)

        return {
          elementId: pathEditingVectorId
        } as PenState
      }

      const firstPoint = createAnchorPoint(dragStartWorkspace)
      const elementId = elementApis.createElement({
        type: 'vector',
        anchorPoints: [firstPoint]
      })
      if (!elementId) {
        return null
      }

      selectionApis.selectElements([elementId])
      systemContextApis.enterPathEditingMode(elementId)
      const selectedPoint = elementApis.getVectorAnchorPointById(
        elementId,
        firstPoint.id
      )
      if (selectedPoint) {
        systemContextApis.setSelectedVectorPoint({
          elementId,
          pointId: selectedPoint.point.id,
          index: selectedPoint.index,
          x: selectedPoint.point.x,
          y: selectedPoint.point.y
        })
      } else {
        systemContextApis.setSelectedVectorPoint(null)
      }

      return {
        elementId
      }
    },

    // Reserved for bezier handle editing on drag.
    onUpdate: (_snapshot: SystemContextSnapshot, _state: PenState) => {
      return
    },
    onEnd: (_snapshot: SystemContextSnapshot, _state: PenState) => {
      return
    }
  }
})

export const selectVectorPointFeature = defineFeature(
  'selectVectorPoint',
  'input.drag',
  {
    priority: 30,
    exclusive: true,
    session: {
      onStart: (snapshot: SystemContextSnapshot) => {
        if (snapshot.primaryTool === PrimaryToolType.PEN) {
          return null
        }

        const selectedIds = selectionApis.getSelectedIds()
        const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
        if (!isPathEditingVectorSelected(selectedIds, pathEditingVectorId)) {
          return null
        }

        const hoveredPoint = systemContextApis.getHoveredVectorPoint()
        if (!hoveredPoint || hoveredPoint.elementId !== pathEditingVectorId) {
          systemContextApis.setSelectedVectorPoint(null)
          return null
        }

        systemContextApis.setSelectedVectorPoint({
          elementId: hoveredPoint.elementId,
          pointId: hoveredPoint.pointId,
          index: hoveredPoint.index,
          x: hoveredPoint.x,
          y: hoveredPoint.y
        })

        return {
          pointId: hoveredPoint.pointId
        }
      }
    }
  }
)

export const hoverVectorPointCursorFeature = defineFeature(
  'hoverVectorPointCursor',
  InputSystemEvents.INPUT_MOUSE_MOVE,
  {
    priority: 20,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
      if (!pathEditingVectorId) {
        cursorApis.resetCanvasCursor()
        systemContextApis.setHoveredVectorPoint(null)
        return null
      }

      const hoveredPoint = elementApis.getVectorAnchorPointAtClientPos(
        pathEditingVectorId,
        snapshot.mouse.position
      )
      systemContextApis.setHoveredVectorPoint(
        hoveredPoint
          ? {
              elementId: pathEditingVectorId,
              pointId: hoveredPoint.point.id,
              index: hoveredPoint.index,
              x: hoveredPoint.point.x,
              y: hoveredPoint.point.y
            }
          : null
      )
      cursorApis.setCanvasCursor(hoveredPoint ? 'pointer' : 'default')
      return null
    }
  }
)

export const cancelPenEditingFeature = defineFeature(
  'cancelPenEditing',
  InputSystemEvents.INPUT_SHORTCUT_CANCEL,
  {
    priority: 100,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      const editingVectorId = systemContextApis.getPathEditingVectorId()
      if (!editingVectorId) {
        cursorApis.resetCanvasCursor()
        return null
      }

      const anchorPoints = elementApis.getVectorAnchorPoints(editingVectorId)
      const startNewSubpath =
        systemContextApis.getPathEditingStartNewSubpath()
      if (!startNewSubpath) {
        const subpathStartIndex = getCurrentSubpathStartIndex(anchorPoints)
        const isSinglePointSubpath =
          subpathStartIndex > 0 &&
          anchorPoints.length - subpathStartIndex === 1 &&
          !!anchorPoints[subpathStartIndex]?.isMove
        if (isSinglePointSubpath) {
          const nextAnchorPoints = anchorPoints.slice(0, subpathStartIndex)
          elementApis.updateVectorGeometry(editingVectorId, nextAnchorPoints)
          systemContextApis.setPathEditingStartNewSubpath(true)
          systemContextApis.clearVectorPointState()
          return { splitPath: true, removedSinglePointSubpath: true }
        }

        systemContextApis.setPathEditingStartNewSubpath(true)
        systemContextApis.clearVectorPointState()
        return { splitPath: true, elementId: editingVectorId }
      }

      systemContextApis.exitPathEditingMode()
      systemContextApis.switchPrimaryTool(PrimaryToolType.SELECT)
      cursorApis.resetCanvasCursor()
      return { cancelled: true, elementId: editingVectorId }
    }
  }
)

export const enterPathEditingFeature = defineFeature(
  'enterPathEditing',
  InputSystemEvents.INPUT_SHORTCUT_ENTER,
  {
    priority: 100,
    exclusive: true,
    execution: () => {
      const selectedIds = selectionApis.getSelectedIds()
      if (selectedIds.length !== 1) {
        return null
      }

      const selectedId = selectedIds[0]
      if (elementApis.getElementType(selectedId) !== 'vector') {
        return null
      }

      systemContextApis.enterPathEditingMode(selectedId)
      return { pathEditingVectorId: selectedId, source: 'enter' }
    }
  }
)

export const enterPathEditingByDoubleClickFeature = defineFeature(
  'enterPathEditingByDoubleClick',
  InputSystemEvents.INPUT_DOUBLE_CLICK,
  {
    priority: 90,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      if (snapshot.primaryTool === PrimaryToolType.PEN) {
        return null
      }

      const selectedIds = selectionApis.getSelectedIds()
      if (selectedIds.length !== 1) {
        return null
      }

      const selectedId = selectedIds[0]
      if (elementApis.getElementType(selectedId) !== 'vector') {
        return null
      }

      const workspacePointerPos = elementApis.getMousePosInWorkspace({
        x: snapshot.mouse.position.x,
        y: snapshot.mouse.position.y
      })

      if (!workspacePointerPos) {
        return null
      }

      const isHitSelectedVector = elementApis.isPointInsideElement(
        selectedId,
        workspacePointerPos,
        DOUBLE_CLICK_HIT_PADDING
      )

      if (!isHitSelectedVector) {
        return null
      }

      systemContextApis.enterPathEditingMode(selectedId)
      return { pathEditingVectorId: selectedId, source: 'double-click' }
    }
  }
)
