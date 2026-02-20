import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/feature-system'
import { elementApis, systemContextApis } from '../../common-apis'

export const hoverElementFeature = defineFeature(
  'hoverElement',
  'input.mouse.move',
  {
    priority: 0,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      const mousePos = snapshot.mouse?.position
      if (!mousePos) {
        return null
      }

      const hoveredId = elementApis.getElementIdAtClientPos(mousePos)
      systemContextApis.updateHoveredElementId(hoveredId)

      return { hoveredId }
    }
  }
)
