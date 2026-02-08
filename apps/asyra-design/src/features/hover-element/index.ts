import { defineFeature } from '@asyra/feature-system'
import { systemContext } from '../../contexts'

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

      systemContext.updateHoveredElementId(payload.elementId)

      return { hoveredId: payload.elementId }
    }
  }
)

export const leaveElementFeature = defineFeature(
  'leaveElement',
  'render.pointer.leave',
  {
    priority: 0,
    exclusive: false,
    api: {},
    execution: (snapshot: any) => {
      const { payload } = snapshot
      if (payload?.elementId) {
        systemContext.updateHoveredElementId(null)
      }
      return null
    }
  }
)
