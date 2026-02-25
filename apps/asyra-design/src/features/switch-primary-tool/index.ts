import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import { defineFeature } from '@asyra/core'
import { systemContextApis } from '../../common-apis'
import {
  FeatureNames,
  InputSystemEvents,
  PrimaryToolType
} from '../../constants'

interface SwitchPrimaryToolAPI {
  switch: (tool: string) => void
  [key: string]: unknown
}

const api: SwitchPrimaryToolAPI = {
  switch: (tool: string) => {
    const pathEditingVectorId = systemContextApis.getPathEditingVectorId()
    systemContextApis.switchPrimaryTool(tool)

    // Tool switch cancels path-editing mode unless switching to Pen.
    if (tool !== PrimaryToolType.PEN && pathEditingVectorId) {
      systemContextApis.exitPathEditingMode()
    }
  }
}

export const switchPrimaryToolFeature = defineFeature(
  FeatureNames.SWITCH_PRIMARY_TOOL,
  InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
  {
    priority: 10,
    exclusive: true,
    api,
    execution: (snapshot: SystemContextSnapshotWithDetail) => {
      const tool = snapshot.detail?.primaryTool as string
      if (tool) {
        api.switch(tool)
        return { tool }
      }
      return null
    }
  }
)

export default switchPrimaryToolFeature
