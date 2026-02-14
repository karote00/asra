import type { SystemContextSnapshotWithDetail } from '@asyra/utils'
import { defineFeature } from '@asyra/feature-system'
import { systemContextApis } from '../../common-apis'
import { InputSystemEvents } from '../../constants'

export const switchPrimaryToolFeature = defineFeature(
  'switchPrimaryTool',
  InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
  {
    api: {
      switch: (tool: string) => {
        systemContextApis.switchPrimaryTool(tool)
      }
    },
    execution: (snapshot: SystemContextSnapshotWithDetail) => {
      const tool = snapshot.detail?.primaryTool
      if (tool) {
        const api = switchPrimaryToolFeature.api as {
          switch: (tool: string) => void
        }
        api.switch(tool)
        return { tool }
      }
      return null
    }
  }
)

export default switchPrimaryToolFeature
