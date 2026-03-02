import type { SystemContextSnapshot } from '@asyra/utils'
import { defineFeature } from '@asyra/core'
import { elementApis, systemContextApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'

export const reEvaluateHoveredElement = (
  snapshot?: SystemContextSnapshot
) => {
  const mousePos =
    snapshot?.mouse?.position ??
    systemContextApis.getSystemContextSnapshot().mouse?.position
  if (!mousePos) {
    systemContextApis.updateHoveredElementId(null)
    return null
  }

  const hoveredId = elementApis.getElementIdAtClientPos(mousePos)
  systemContextApis.updateHoveredElementId(hoveredId)

  return hoveredId
}

export const hoverElementFeature = defineFeature(
  FeatureNames.HOVER_ELEMENT,
  InputSystemEvents.INPUT_MOUSE_MOVE,
  {
    api: {
      reEvaluate: reEvaluateHoveredElement
    },
    priority: 0,
    exclusive: false,
    execution: (snapshot: SystemContextSnapshot) => {
      const hoveredId = reEvaluateHoveredElement(snapshot)
      if (hoveredId === null) {
        return null
      }

      return { hoveredId }
    }
  }
)
