import {
  type EVENT_OPTIONS,
  type PositionData,
  type Rect,
  type SystemContextSnapshot,
  rectFromPoints
} from '@asyra/utils'
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
  dragStartWorkspacePos: PositionData | null
  latestBounds: Rect | null
  [key: string]: unknown
}

interface CreateElementAPI {
  createElement: (position: PositionData, type: string) => string | null
  updateElementSizeAndPosition: (
    elementId: string,
    dragStart: PositionData,
    currentPos: PositionData
  ) => Rect
  resetElementSize: (elementId: string, options?: EVENT_OPTIONS) => void
  hasMovedBeyondThreshold: (
    clientDragStart: PositionData,
    clientCurrentPos: PositionData
  ) => boolean
  [key: string]: unknown
}

const api: CreateElementAPI = {
  createElement: (position: PositionData, type: string) => {
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
    dragStart: PositionData,
    currentPos: PositionData
  ) => {
    const bounds = rectFromPoints(dragStart, currentPos)

    elementApis.changeComputedData(
      [elementId],
      { ...bounds },
      {
        sharedDelivery: 'immediate'
      }
    )
    return bounds
  },
  resetElementSize: (elementId, options) => {
    elementApis.resetElementSize(elementId, options)
  },
  hasMovedBeyondThreshold: (
    clientDragStart: PositionData,
    clientCurrentPos: PositionData
  ) => {
    return elementApis.hasMovedBeyondThreshold(
      clientDragStart,
      clientCurrentPos,
      FEATURE_MOVEMENT_THRESHOLD.createElement
    )
  }
}

const boundsMatch = (left: Rect | null, right: Rect | null): boolean =>
  Boolean(
    left &&
      right &&
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height
  )

export const createElementSession = {
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
      selectionApis.selectElements([elementId])
    }

    return {
      elementId,
      dragStartWorkspacePos: dragStartWorkspace,
      latestBounds: null
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

    state.latestBounds = api.updateElementSizeAndPosition(
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
      api.resetElementSize(state.elementId, { sharedDelivery: 'immediate' })
    } else {
      const currentWorkspacePos = elementApis.getMousePosInWorkspace({
        x: snapshot.mousePosition.x,
        y: snapshot.mousePosition.y
      })
      if (currentWorkspacePos && state.dragStartWorkspacePos) {
        const finalBounds = rectFromPoints(
          state.dragStartWorkspacePos,
          currentWorkspacePos
        )
        if (!boundsMatch(finalBounds, state.latestBounds)) {
          state.latestBounds = api.updateElementSizeAndPosition(
            state.elementId,
            state.dragStartWorkspacePos,
            currentWorkspacePos
          )
        }
      }
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

export const createElementFeature = defineFeature<
  CreateElementAPI,
  CreateElementState
>(FeatureNames.CREATE_ELEMENT, InputSystemEvents.INPUT_DRAG, {
  priority: 10,
  exclusive: true,
  cancelPolicy: 'commit-current',
  api,
  session: createElementSession
})
