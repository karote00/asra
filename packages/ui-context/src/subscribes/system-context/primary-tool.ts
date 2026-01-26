import {
  requestCurrentPrimaryTool,
  subscribeToEmitSwitchPrimaryTool
} from '@asyra/reactive-events'
import { PrimaryToolStore } from '../../stores/system-context'

export const primaryToolStore = new PrimaryToolStore()

let hasInit = false

export const initPrimaryToolSubscribe = () => {
  if (hasInit) {
    return
  }

  subscribeToEmitSwitchPrimaryTool(async () => {
    const primaryTool = await requestCurrentPrimaryTool()
    primaryToolStore.updatePrimaryTool(primaryTool)
  })

  hasInit = true
}
