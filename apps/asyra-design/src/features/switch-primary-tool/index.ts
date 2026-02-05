import core from '../../contexts'
import { InputSystemEvents } from '../../constants'
import { defineFeature } from '@asyra/feature-system'
import uiContext from '@asyra/ui-context'
import { featureKeyConfigs } from '../../config/key-combinations'

export const switchPrimaryToolFeature = defineFeature(
  'switchPrimaryTool',
  featureKeyConfigs,
  {
    name: 'switchPrimaryTool',
    api: {
      switch: (tool: string) => {
        core.deps.systemContext.switchPrimaryTool(tool)
        uiContext.updatePrimaryTool(tool)
      }
    },
    define: ({ handle }: any) => {
      handle(
        InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
        (snapshot: any, detail: any) => {
          const tool = snapshot.detail?.primaryTool || detail?.primaryTool
          return {
            type: 'INTERACTION_SWITCH_PRIMARY_TOOL',
            payload: { tool },
            handler: ({ tool }: any) => {
              const api = switchPrimaryToolFeature.api
              if (api?.switch) {
                api.switch(tool)
              }
            }
          }
        }
      )
    }
  }
)

export default switchPrimaryToolFeature
