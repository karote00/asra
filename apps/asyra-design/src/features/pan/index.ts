import { defineFeature } from '@asyra/feature-system'
import { viewportApis } from '../../common-apis'
import { InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

export const panFeature = defineFeature(
  'pan',
  InputSystemEvents.INPUT_WHEEL_SCROLL,
  {
    priority: 4,
    exclusive: false,
    api: {
      pan: (deltaX: number, deltaY: number) => {
        const currentPosition = viewportApis.getPosition()
        viewportApis.panTo(
          currentPosition.x + deltaX,
          currentPosition.y + deltaY
        )
      }
    },
    execution: (snapshot: SystemContextSnapshot) => {
      const api = panFeature.api as {
        pan: (deltaX: number, deltaY: number) => void
      }

      if (snapshot.key.meta || snapshot.key.ctrl) {
        return null
      }

      const { x: deltaX, y: deltaY } = snapshot.mouse.delta

      api.pan(-deltaX, -deltaY)

      return { panned: true }
    }
  }
)

export default panFeature
