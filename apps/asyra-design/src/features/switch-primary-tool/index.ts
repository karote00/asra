import { systemContext } from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import { InputSystemEvents } from '../../constants'
import { uiContextApis } from '../../common-apis'

export const switchPrimaryToolFeature = defineFeature(
  'switchPrimaryTool',
  InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
  {
    api: {
      switch: (tool: string) => {
        systemContext.switchPrimaryTool(tool)
        uiContextApis.updatePrimaryTool(tool)
      }
    },
    execution: (snapshot: any) => {
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
