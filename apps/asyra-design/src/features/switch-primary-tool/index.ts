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

    if (!pathEditingVectorId) {
      return
    }

    // Keep path editing active for Select, but disconnect preview segment.
    if (tool === PrimaryToolType.SELECT) {
      systemContextApis.setPathEditingStartNewSubpath(true)
      return
    }

    // Switching to Pen keeps current path-editing context.
    if (tool === PrimaryToolType.PEN) {
      return
    }

    // Other tools leave path-editing mode.
    systemContextApis.exitPathEditingMode()
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
