import { defineFeature } from '@asyra/core'
import { ZOOM_SMOOTH_RATIO } from '@asyra/utils'
import { viewportApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

interface ZoomAPI {
  zoom: (deltaY: number, clientX: number, clientY: number) => void
  [key: string]: unknown
}

const api: ZoomAPI = {
  zoom: (deltaY: number, clientX: number, clientY: number) => {
    const currentScale = viewportApis.getScale()
    const newScale =
      currentScale *
      (deltaY < 0 ? 1 + ZOOM_SMOOTH_RATIO : 1 - ZOOM_SMOOTH_RATIO)
    viewportApis.zoomToCenter(newScale, clientX, clientY)
  }
}

export const zoomFeature = defineFeature(
  FeatureNames.ZOOM,
  InputSystemEvents.INPUT_WHEEL_SCROLL,
  {
    priority: 5,
    exclusive: true,
    api,
    execution: (snapshot: SystemContextSnapshot) => {
      if (!snapshot.key.meta && !snapshot.key.ctrl) {
        return null
      }

      const { y: deltaY } = snapshot.mouse.delta
      const { x: clientX, y: clientY } = snapshot.mouse.position

      api.zoom(deltaY, clientX, clientY)

      return { zoomed: true }
    }
  }
)

export default zoomFeature
