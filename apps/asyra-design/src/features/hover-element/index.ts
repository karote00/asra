import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/core'
import { elementApis, systemContextApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'

export const hoverElementFeature = defineFeature(
  FeatureNames.HOVER_ELEMENT,
  InputSystemEvents.INPUT_MOUSE_MOVE,
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
