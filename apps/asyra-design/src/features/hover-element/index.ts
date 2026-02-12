import { defineFeature } from '@asyra/feature-system'
import { systemContextApis } from '../../common-apis'

export const hoverElementFeature = defineFeature(
  'hoverElement',
  'render.pointer.hover',
  {
    priority: 0,
    exclusive: false,
    execution: (snapshot: any) => {
      const { payload } = snapshot
      if (!payload || !payload.elementId) {
        return null
      }

      systemContextApis.updateHoveredElementId(payload.elementId)

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
    execution: (snapshot: any) => {
      const { payload } = snapshot
      if (payload?.elementId) {
        systemContextApis.updateHoveredElementId(null)
      }
      return null
    }
  }
)
