import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import {
  subscribeToRenderPointerHover,
  subscribeToRenderPointerLeave
} from '@asyra/reactive-events'

export const hoverElementFeature = defineFeature(
  'hoverElement',
  'render.pointer.hover',
  {
    priority: 0,
    exclusive: false,
    api: {},
    execution: (snapshot: any) => {
      const { payload } = snapshot
      if (!payload || !payload.elementId) {
        return null
      }

      core.deps.systemContext.updateHoveredElementId(payload.elementId)

      return { hoveredId: payload.elementId }
    }
  }
)

// Also subscribe to pointer leave events to clear hovered element
subscribeToRenderPointerLeave(({ payload }) => {
  if (payload?.elementId) {
    core.deps.systemContext.updateHoveredElementId(null)
  }
})
