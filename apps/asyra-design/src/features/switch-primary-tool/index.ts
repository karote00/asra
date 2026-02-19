import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import { defineFeature } from '@asyra/feature-system'
import { systemContextApis } from '../../common-apis'
import { InputSystemEvents, PrimaryToolType } from '../../constants'

interface SwitchPrimaryToolAPI {
  switch: (tool: string) => void
  [key: string]: unknown
}

const api: SwitchPrimaryToolAPI = {
  switch: (tool: string) => {
    systemContextApis.switchPrimaryTool(tool)
    if (tool !== PrimaryToolType.PEN) {
      systemContextApis.setPathEditingVectorId(null)
    }
  }
}

export const switchPrimaryToolFeature = defineFeature(
  'switchPrimaryTool',
  InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
  {
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
