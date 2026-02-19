import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/feature-system'
import {
  elementApis,
  selectionApis,
  systemContextApis
} from '../../common-apis'
import { PrimaryToolType, InputSystemEvents } from '../../constants'

interface AnchorPoint {
  id: string
  x: number
  y: number
  type: 'smooth' | 'sharp'
  inHandle: { x: number; y: number } | null
  outHandle: { x: number; y: number } | null
}

interface PenState {
  elementId: string
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

const createAnchorPoint = (point: { x: number; y: number }): AnchorPoint => ({
  id: `anchor-${generateId()}`,
  x: point.x,
  y: point.y,
  type: 'sharp',
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

      if (isPathEditingVectorSelected(selectedIds, pathEditingVectorId)) {
        const anchorPoints =
          elementApis.getVectorAnchorPoints(pathEditingVectorId)
        anchorPoints.push(createAnchorPoint(dragStartWorkspace))
        elementApis.updateVectorPath(pathEditingVectorId, anchorPoints)
        selectionApis.selectElements([pathEditingVectorId])

        return {
          elementId: pathEditingVectorId
        } as PenState
      }

      const elementId = elementApis.createVector([
        createAnchorPoint(dragStartWorkspace)
      ])
      if (!elementId) {
        return null
      }

      selectionApis.selectElements([elementId])
      systemContextApis.setPathEditingVectorId(elementId)

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
  InputSystemEvents.INPUT_SHORTCUT_CANCEL_PEN,
  {
    priority: 100,
    exclusive: true,
    execution: (snapshot: SystemContextSnapshot) => {
      if (snapshot.primaryTool !== PrimaryToolType.PEN) {
        return null
      }

      const editingVectorId = systemContextApis.getPathEditingVectorId()
      if (!editingVectorId) {
        return null
      }

      systemContextApis.setPathEditingVectorId(null)
      return { cancelled: true, elementId: editingVectorId }
    }
  }
)

export const enterPathEditingFeature = defineFeature(
  'enterPathEditing',
  InputSystemEvents.INPUT_SHORTCUT_ENTER_PATH_EDIT,
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

      const workspacePointerPos = elementApis.getMousePosInWorkspace({
        x: snapshot.mouse.position.x,
        y: snapshot.mouse.position.y
      })

      if (!workspacePointerPos) {
        return null
      }

      const vectorId = elementApis.findVectorAtPoint(
        workspacePointerPos,
        DOUBLE_CLICK_HIT_PADDING
      )

      if (!vectorId) {
        return null
      }

      selectionApis.selectElements([vectorId])
      systemContextApis.setPathEditingVectorId(vectorId)
      return { pathEditingVectorId: vectorId, source: 'double-click' }
    }
  }
)
