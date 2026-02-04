import core from '../../contexts'
import { InputSystemEvents } from '../../constants'
import { defineFeature } from '@asyra/feature-system'
import uiContext from '@asyra/ui-context'
import { featureKeyConfigs } from '../../config/key-combinations'

console.log('[switch-primary-tool/index] Module loading...')
console.log('[switch-primary-tool/index] featureKeyConfigs:', featureKeyConfigs)

export const switchPrimaryToolFeature = defineFeature(
  'switchPrimaryTool',
  featureKeyConfigs,
  {
    name: 'switchPrimaryTool',
    api: {
      switch: (tool: string) => {
        console.log('[switchPrimaryTool.api.switch] Switching to:', tool)
        core.deps.systemContext.switchPrimaryTool(tool)
        uiContext.updatePrimaryTool(tool)
        console.log('[switchPrimaryTool.api.switch] Switch complete')
      }
    },
    define: ({ handle }: any) => {
      console.log('[switchPrimaryTool.define] Defining handlers...')
      handle(
        InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
        (snapshot: any, detail: any) => {
          console.log('[switchPrimaryTool.handle] Called with:', {
            snapshot,
            detail
          })
          const tool = snapshot.detail?.primaryTool || detail?.primaryTool
          console.log('[switchPrimaryTool.handle] Extracted tool:', tool)
          return {
            type: 'INTERACTION_SWITCH_PRIMARY_TOOL',
            payload: { tool },
            handler: ({ tool }: any) => {
              console.log(
                '[switchPrimaryTool.handler] Executing with tool:',
                tool
              )
              const api = switchPrimaryToolFeature.api
              if (api?.switch) {
                api.switch(tool)
              }
            }
          }
        }
      )
      console.log('[switchPrimaryTool.define] Handlers defined')
    }
  }
)

console.log('[switch-primary-tool/index] Feature defined successfully')

export default switchPrimaryToolFeature
