import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'
import uiContext from '@asyra/ui-context'
import { InputSystemEvents } from '../../constants'

export const switchPrimaryToolFeature = defineFeature(
  'switchPrimaryTool',
  'input.shortcut.switchPrimaryTool', // Keyboard shortcut event
  {
    name: 'switchPrimaryTool',
    api: {
      switch: (tool: string) => {
        core.deps.systemContext.switchPrimaryTool(tool)
        uiContext.updatePrimaryTool(tool)
      }
    },
    define: ({ execution }: any) => {
      execution.register(
        InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
        {},
        (snapshot: any) => {
          const tool = snapshot.detail?.primaryTool
          if (tool) {
            const api = switchPrimaryToolFeature.api
            if (api?.switch) {
              api.switch(tool)
            }
          }
          return { tool }
        }
      )
    }
  }
)

export default switchPrimaryToolFeature
