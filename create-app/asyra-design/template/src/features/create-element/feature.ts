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
  systemContextApis,
  transactionApis
} from '../../common-apis'
import {
  FEATURE_MOVEMENT_THRESHOLD,
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'
import { resolveCreateElementParentAtClientPos } from '../../controllers/canvas-hierarchy-target'

interface CreateElementState {
  elementId: string | null
  parentId: string
  dragStartWorkspacePos: PositionData | null
  latestBounds: Rect | null
  [key: string]: unknown
}

interface CreateElementAPI {
  createElement: (
    position: PositionData,
    type: string,
    parentId: string
  ) => string | null
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

const CREATE_GEOMETRY_OPTIONS = {
  sharedDelivery: 'immediate',
  history: {
    mode: 'replace-latest',
    key: 'create-element:geometry'
  }
} as const satisfies EVENT_OPTIONS

const api: CreateElementAPI = {
  createElement: (position: PositionData, type: string, parentId: string) => {
    return elementApis.createElement(
      {
        type,
        clientPosition: position,
        parentId
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

    elementApis.changeElementGeometry(
      elementId,
      bounds,
      CREATE_GEOMETRY_OPTIONS
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
    const parentId = resolveCreateElementParentAtClientPos(snapshot)
    if (!parentId) {
      return null
    }

    const dragStartWorkspace = elementApis.getMousePosInWorkspace({
      x: snapshot.mousePosition.x,
      y: snapshot.mousePosition.y
    })
    if (!dragStartWorkspace) {
      return null
    }
    transactionApis.configureSharedDeliverySequence({
      mode: 'atomic',
      batchPublications: false,
      slices: []
    })
    const elementId = api.createElement(
      snapshot.mousePosition,
      primaryTool,
      parentId
    )
    if (elementId) {
      selectionApis.selectElements([elementId], {
        sharedDelivery: 'immediate'
      })
    }

    return {
      elementId,
      parentId,
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
    const dragStartParentPos = elementApis.getPositionInParent(
      state.parentId,
      state.dragStartWorkspacePos
    )
    const currentParentPos = elementApis.getPositionInParent(
      state.parentId,
      currentWorkspacePos
    )
    if (!dragStartParentPos || !currentParentPos) {
      return
    }

    api.updateElementSizeAndPosition(
      state.elementId,
      dragStartParentPos,
      currentParentPos
    )
    state.latestBounds = rectFromPoints(
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
      const currentParentPos = currentWorkspacePos
        ? elementApis.getPositionInParent(state.parentId, currentWorkspacePos)
        : null
      const dragStartWorkspacePos = state.dragStartWorkspacePos
      const dragStartParentPos = dragStartWorkspacePos
        ? elementApis.getPositionInParent(state.parentId, dragStartWorkspacePos)
        : null
      if (
        currentWorkspacePos &&
        currentParentPos &&
        dragStartParentPos &&
        dragStartWorkspacePos
      ) {
        const finalWorkspaceBounds = rectFromPoints(
          dragStartWorkspacePos,
          currentWorkspacePos
        )
        if (!boundsMatch(finalWorkspaceBounds, state.latestBounds)) {
          api.updateElementSizeAndPosition(
            state.elementId,
            dragStartParentPos,
            currentParentPos
          )
          state.latestBounds = finalWorkspaceBounds
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
