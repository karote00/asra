import { defineFeature } from '@asyra/feature-system'
import { viewportApis } from '../../common-apis'
import { InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

export const zoomFitFeature = defineFeature(
  'zoomFit',
  InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
  {
    priority: 10,
    exclusive: true,
    api: {
      zoomFit: () => {
        viewportApis.zoomFit()

        const newScale = viewportApis.getScale()
        viewportApis.updateZoomUI(newScale)
      }
    },
    execution: (snapshot: SystemContextSnapshot) => {
      const api = zoomFitFeature.api as {
        zoomFit: () => void
      }

      api.zoomFit()

      return { zoomedToFit: true }
    }
  }
)

export default zoomFitFeature
