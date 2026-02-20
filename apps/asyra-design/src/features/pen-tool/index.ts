import { idCounter, type SystemContextSnapshot } from '@asyra/utils'
import type { VectorAnchorPoint } from '@asyra/core'
import { defineFeature } from '@asyra/feature-system'
import {
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import { PrimaryToolType, InputSystemEvents } from '../../constants'

interface PenState {
  elementId: string
}

const ANCHOR_ID_TYPE = 'vector-anchor'
const ANCHOR_ID_PREFIX = 'anchor'

idCounter.registerType(ANCHOR_ID_TYPE, ANCHOR_ID_PREFIX)

const createAnchorPoint = (
  point: { x: number; y: number },
  options?: { isMove?: boolean }
): VectorAnchorPoint => ({
  id: idCounter.increase(ANCHOR_ID_TYPE),
  x: point.x,
  y: point.y,
  type: 'sharp',
  isMove: options?.isMove,
  inHandle: null,
  outHandle: null
})

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
        const anchorPoints =
          elementApis.getVectorAnchorPoints(pathEditingVectorId)
        anchorPoints.push(
          createAnchorPoint(dragStartWorkspace, {
            isMove: startNewSubpath
          })
        )
        elementApis.updateVectorPath(pathEditingVectorId, anchorPoints)
        selectionApis.selectElements([pathEditingVectorId])
        if (startNewSubpath) {
          systemContextApis.setPathEditingStartNewSubpath(false)
        }

        return {
          elementId: pathEditingVectorId
        } as PenState
      }

      const elementId = elementApis.createElement({
        type: 'vector',
        anchorPoints: [createAnchorPoint(dragStartWorkspace)]
      })
      if (!elementId) {
        return null
      }

      selectionApis.selectElements([elementId])
      systemContextApis.setPathEditingVectorId(elementId)
      systemContextApis.setPathEditingStartNewSubpath(false)

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

export const cancelPenEditingFeature = defineFeature(
  'cancelPenEditing',
  InputSystemEvents.INPUT_SHORTCUT_CANCEL,
  {
    priority: 100,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      const editingVectorId = systemContextApis.getPathEditingVectorId()
      if (!editingVectorId) {
        return null
      }

      const startNewSubpath =
        systemContextApis.getPathEditingStartNewSubpath()
      if (!startNewSubpath) {
        systemContextApis.setPathEditingStartNewSubpath(true)
        return { splitPath: true, elementId: editingVectorId }
      }

      systemContextApis.setPathEditingVectorId(null)
      systemContextApis.setPathEditingStartNewSubpath(false)
      systemContextApis.switchPrimaryTool(PrimaryToolType.SELECT)
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

      systemContextApis.setPathEditingVectorId(selectedId)
      systemContextApis.setPathEditingStartNewSubpath(false)
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

      systemContextApis.setPathEditingVectorId(selectedId)
      systemContextApis.setPathEditingStartNewSubpath(false)
      return { pathEditingVectorId: selectedId, source: 'double-click' }
    }
  }
)
