import { defineFeature } from '@asyra/feature-system'
import { render } from '../../contexts'
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
        const currentPosition = render.getViewportPosition()
        render.panTo(currentPosition.x + deltaX, currentPosition.y + deltaY)
      }
    },
    execution: (snapshot: SystemContextSnapshot) => {
      const api = panFeature.api as {
        pan: (deltaX: number, deltaY: number) => void
      }

      // Pan if Meta (Cmd) NOT pressed (2-finger touchpad = pan, Cmd+3-finger = zoom)
      if (snapshot.key.meta) {
        return null
      }

      const { x: deltaX, y: deltaY } = snapshot.mouse.delta

      // Pan viewport (negate delta to match natural cursor direction)
      api.pan(-deltaX, -deltaY)

      return { panned: true }
    }
  }
)

export default panFeature
