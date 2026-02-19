import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/feature-system'
import { startTransaction, endTransaction } from '@asyra/reactive-events'
import { elementApis, selectionApis } from '../../common-apis'
import { PrimaryToolType, MOUSE_MOVEMENT_THRESHOLD } from '../../constants'
import core from '../../contexts'

interface AnchorPoint {
  id: string
  x: number
  y: number
  type: 'smooth' | 'sharp'
  inHandle: { x: number; y: number } | null
  outHandle: { x: number; y: number } | null
}

interface PenState {
  elementId: string | null
  points: { x: number; y: number }[]
  dragStartWorkspace: { x: number; y: number } | null
  lastPoint: { x: number; y: number } | null
  [key: string]: unknown
}

interface PenAPI {
  addPoint: (point: { x: number; y: number }) => void
  finishPath: (close: boolean) => string | null
  cancelDrawing: () => void
  calculateBounds: (points: { x: number; y: number }[]) => {
    x: number
    y: number
    width: number
    height: number
  }
  generateId: () => string
  [key: string]: unknown
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

const api: PenAPI = {
  generateId,

  addPoint: (point: { x: number; y: number }) => {
    return // Points are managed in state
  },

  calculateBounds: (
    points: { x: number; y: number }[]
  ): { x: number; y: number; width: number; height: number } => {
    if (points.length === 0) return { x: 0, y: 0, width: 1, height: 1 }

    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs) || 1,
      height: Math.max(...ys) - Math.min(...ys) || 1
    }
  },

  finishPath: (close: boolean) => {
    return null // This is handled in the feature's onEnd
  },

  cancelDrawing: () => {
    return
  }
}

export const penFeature = defineFeature<PenAPI, PenState>('pen', 'input.drag', {
  priority: 15,
  exclusive: true,
  api,
  session: {
    onStart: (snapshot: SystemContextSnapshot) => {
      const { primaryTool } = snapshot

      if (primaryTool !== PrimaryToolType.PEN) {
        return null
      }

      const dragStartWorkspace = elementApis.getMousePosInWorkspace({
        x: snapshot.mouse.position.x,
        y: snapshot.mouse.position.y
      })

      if (!dragStartWorkspace) {
        return null
      }

      return {
        elementId: null,
        points: [dragStartWorkspace],
        dragStartWorkspace,
        lastPoint: dragStartWorkspace
      }
    },

    onUpdate: (snapshot: SystemContextSnapshot, state: PenState) => {
      if (!state || !state.dragStartWorkspace) {
        return
      }

      if (!snapshot.mouse.dragging) {
        return
      }

      const currentWorkspacePos = elementApis.getMousePosInWorkspace({
        x: snapshot.mouse.position.x,
        y: snapshot.mouse.position.y
      })

      if (!currentWorkspacePos) {
        return
      }

      const distance = Math.sqrt(
        Math.pow(currentWorkspacePos.x - state.lastPoint!.x, 2) +
          Math.pow(currentWorkspacePos.y - state.lastPoint!.y, 2)
      )

      if (distance > MOUSE_MOVEMENT_THRESHOLD) {
        state.points.push(currentWorkspacePos)
        return {
          ...state,
          lastPoint: currentWorkspacePos
        }
      }
    },

    onEnd: (snapshot: SystemContextSnapshot, state: PenState) => {
      if (!state || state.points.length === 0) {
        return null
      }

      const bounds = api.calculateBounds(state.points)

      const anchorPoints: AnchorPoint[] = state.points.map((p) => ({
        id: `anchor-${generateId()}`,
        x: p.x - bounds.x,
        y: p.y - bounds.y,
        type: 'sharp',
        inHandle: null,
        outHandle: null
      }))

      const shouldClose = state.points.length > 2

      const vectorData = {
        type: 'vector' as const,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        anchorPoints,
        closed: shouldClose,
        fill: 'none',
        stroke: '#ffffff',
        strokeWidth: 2
      }

      startTransaction()
      const elementId = core.createElement(vectorData)
      endTransaction()

      if (elementId) {
        selectionApis.selectElements([elementId])
      }

      return {
        elementId,
        closed: shouldClose,
        pointCount: state.points.length
      }
    }
  }
})
