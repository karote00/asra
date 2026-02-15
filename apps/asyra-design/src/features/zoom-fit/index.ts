import { defineFeature } from '@asyra/feature-system'
import { viewportApis } from '../../common-apis'
import { InputSystemEvents } from '../../constants'
import type { SystemContextSnapshot } from '@asyra/utils'

interface ZoomFitAPI {
  zoomFit: () => void
  [key: string]: unknown
}

const api: ZoomFitAPI = {
  zoomFit: () => {
    viewportApis.zoomFit()
  }
}

export const zoomFitFeature = defineFeature(
  'zoomFit',
  InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
  {
    priority: 10,
    exclusive: true,
    api,
    execution: (snapshot: SystemContextSnapshot) => {
      api.zoomFit()
      return { zoomedToFit: true }
    }
  }
)

export default zoomFitFeature
