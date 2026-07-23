import { defineFeature } from '@asyra/core'
import { viewportApis } from '../../common-apis'
import { FeatureNames, InputSystemEvents } from '../../constants'
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
  FeatureNames.ZOOM_FIT,
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
