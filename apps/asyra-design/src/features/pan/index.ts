import { defineFeature } from '@asyra/core'
import { viewportApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

interface PanAPI {
  pan: (deltaX: number, deltaY: number) => void
  [key: string]: unknown
}

const api: PanAPI = {
  pan: (deltaX: number, deltaY: number) => {
    const currentPosition = viewportApis.getPosition()
    viewportApis.panTo(currentPosition.x + deltaX, currentPosition.y + deltaY)
  }
}

export const panFeature = defineFeature(
  FeatureNames.PAN,
  InputSystemEvents.INPUT_WHEEL_SCROLL,
  {
    priority: 4,
    exclusive: false,
    api,
    execution: (snapshot: SystemContextSnapshot) => {
      if (snapshot.keyMeta || snapshot.keyCtrl) {
        return null
      }

      const { x: deltaX, y: deltaY } = snapshot.mouseDelta

      api.pan(-deltaX, -deltaY)

      return { panned: true }
    }
  }
)

export default panFeature
