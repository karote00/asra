import { MouseSnapshot, PrimaryToolType } from '@asra/utils'
import { SystemContextAPIs } from '../types'
import { initPrimaryToolSubscribe } from './primary-tool'
import { initMouseStateSubscribe } from './mouse-state'

export const initSystemContextSubscribe = (apis: SystemContextAPIs) => {
  initPrimaryToolSubscribe({
    getCurrentPrimaryTool: () => apis.getCurrentPrimaryTool(),
    switchPrimaryTool: (tool: PrimaryToolType) => apis.switchPrimaryTool(tool)
  })

  initMouseStateSubscribe({
    updateMouseState: (mouseSnapshot: MouseSnapshot) =>
      apis.updateMouseState(mouseSnapshot)
  })
}
