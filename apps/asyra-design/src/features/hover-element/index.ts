import { defineFeature } from '@asyra/feature-system'
import { systemContextApis } from '../../common-apis'

export const hoverElementFeature = defineFeature(
  'hoverElement',
  'render.pointer.hover',
  {
    priority: 0,
    exclusive: false,
    execution: (snapshot: any) => {
      const { detail } = snapshot
      if (!detail || !detail.elementId) {
        return null
      }

      systemContextApis.updateHoveredElementId(detail.elementId)

      return { hoveredId: detail.elementId }
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
      const { detail } = snapshot
      if (detail?.elementId) {
        systemContextApis.updateHoveredElementId(null)
      }
      return null
    }
  }
)
