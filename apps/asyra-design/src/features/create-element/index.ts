import type { SystemContextSnapshot } from '@asyra/utils'
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

interface CreateElementState {
  elementId: string | null
  dragStartWorkspacePos: { x: number; y: number } | null
  [key: string]: unknown
}

interface CreateElementAPI {
  createElement: (
    position: { x: number; y: number },
    type: string
  ) => string | null
  updateElementSizeAndPosition: (
    elementId: string,
    dragStart: { x: number; y: number },
    currentPos: { x: number; y: number }
  ) => void
  resetElementSize: (elementId: string) => void
  hasMovedBeyondThreshold: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number }
  ) => boolean
  [key: string]: unknown
}

const api: CreateElementAPI = {
  createElement: (position: { x: number; y: number }, type: string) => {
    return elementApis.createElement(
      {
        type,
        clientPosition: position
      },
      {
        sharedDelivery: 'immediate'
      }
    )
  },
  updateElementSizeAndPosition: (
    elementId: string,
    dragStart: { x: number; y: number },
    currentPos: { x: number; y: number }
  ) => {
    let width = currentPos.x - dragStart.x
    let height = currentPos.y - dragStart.y
    let x = dragStart.x
    let y = dragStart.y

    if (width < 0) {
      width = Math.abs(width)
      x = currentPos.x
    }

    if (height < 0) {
      height = Math.abs(height)
      y = currentPos.y
    }

    elementApis.changeComputedData(
      [elementId],
      {
        x,
        y,
        width,
        height
      },
      { undoable: false }
    )
  },
  resetElementSize: (elementId: string) => {
    elementApis.resetElementSize(elementId)
  },
  hasMovedBeyondThreshold: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number }
  ) => {
    return elementApis.hasMovedBeyondThreshold(
      clientDragStart,
      clientCurrentPos,
      FEATURE_MOVEMENT_THRESHOLD.createElement
    )
  }
}

export const createElementFeature = defineFeature<
  CreateElementAPI,
  CreateElementState
>(FeatureNames.CREATE_ELEMENT, InputSystemEvents.INPUT_DRAG, {
  priority: 10,
  exclusive: true,
  cancelPolicy: 'rollback',
  api,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const { primaryTool } = snapshot

      if (
        primaryTool !== PrimaryToolType.RECTANGLE &&
        primaryTool !== PrimaryToolType.OVAL
      ) {
        return null
      }

      const dragStartWorkspace = elementApis.getMousePosInWorkspace({
        x: snapshot.mousePosition.x,
        y: snapshot.mousePosition.y
      })
      if (!dragStartWorkspace) {
        return null
      }

      const elementId = api.createElement(snapshot.mousePosition, primaryTool)
      if (elementId) {
        selectionApis.selectElements([elementId], {
          sharedDelivery: 'immediate'
        })
      }

      return {
        elementId,
        dragStartWorkspacePos: dragStartWorkspace
      } as CreateElementState
    },
    onUpdate: (snapshot: SystemContextSnapshot, state: CreateElementState) => {
      if (!state || state.elementId === null || !state.dragStartWorkspacePos) {
        return
      }

      if (!snapshot.mouseDragging) {
        return
      }

      const currentWorkspacePos = elementApis.getMousePosInWorkspace({
        x: snapshot.mousePosition.x,
        y: snapshot.mousePosition.y
      })
      if (!currentWorkspacePos) {
        return
      }

      api.updateElementSizeAndPosition(
        state.elementId,
        state.dragStartWorkspacePos,
        currentWorkspacePos
      )
    },
    onEnd: (snapshot: SystemContextSnapshot, state: CreateElementState) => {
      if (!state || state.elementId === null) {
        return
      }

      // If user just clicked without significant drag, reset to default size
      // This handles accidental movements (hand tremors, etc.)
      const hasSignificantMove = api.hasMovedBeyondThreshold(
        snapshot.mouseDragStart || snapshot.mousePosition,
        snapshot.mousePosition
      )

      if (!hasSignificantMove) {
        api.resetElementSize(state.elementId)
      }

      if (
        snapshot.primaryTool === PrimaryToolType.RECTANGLE ||
        snapshot.primaryTool === PrimaryToolType.OVAL
      ) {
        systemContextApis.switchPrimaryTool(PrimaryToolType.SELECT)
      }
    },
    onCancel: () => undefined
  }
})
