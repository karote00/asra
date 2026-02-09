import { defineFeature } from '@asyra/feature-system'
import { ZOOM_SMOOTH_RATIO } from '@asyra/utils'
import { render } from '../../contexts'
import { InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

export const zoomFeature = defineFeature(
  'zoom',
  InputSystemEvents.INPUT_WHEEL_SCROLL,
  {
    priority: 5,
    exclusive: true,
    api: {
      zoom: (deltaY: number, clientX: number, clientY: number) => {
        const currentScale = render.getViewportScale()
        const newScale =
          currentScale *
          (deltaY < 0 ? 1 + ZOOM_SMOOTH_RATIO : 1 - ZOOM_SMOOTH_RATIO)
        render.zoomToCenter(newScale, clientX, clientY)
      }
    },
    execution: (snapshot: SystemContextSnapshot) => {
      const api = zoomFeature.api as {
        zoom: (deltaY: number, clientX: number, clientY: number) => void
      }

      // Zoom only if Meta (Cmd) modifier is pressed (3-finger touchpad)
      if (!snapshot.key.meta) {
        return null
      }

      const { y: deltaY } = snapshot.mouse.delta
      const { x: clientX, y: clientY } = snapshot.mouse.position

      // Use deltaY for zoom (positive = zoom out, negative = zoom in)
      api.zoom(deltaY, clientX, clientY)

      return { zoomed: true }
    }
  }
)

export default zoomFeature
