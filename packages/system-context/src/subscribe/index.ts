import { MouseSnapshot, PrimaryToolType } from '@asra/utils'
import { initRootSubscribe } from './root'
import { initPrimaryToolStateSubscribe } from './primary-tool-state'
import { initMouseStateSubscribe } from './mouse-state'
import { initSystemStateSubscribe } from './system-state'
import { SystemContextAPIs } from '../types'

export const initSystemContextSubscribe = (apis: SystemContextAPIs) => {
  initRootSubscribe({
    getSystemSnapshot: () => apis.getSystemSnapshot()
  })

  initPrimaryToolStateSubscribe({
    getCurrentPrimaryTool: () => apis.getCurrentPrimaryTool(),
    switchPrimaryTool: (tool: PrimaryToolType) => apis.switchPrimaryTool(tool)
  })

  initMouseStateSubscribe({
    updateMouseState: (mouseSnapshot: MouseSnapshot) =>
      apis.updateMouseState(mouseSnapshot),
    getMouseState: () => apis.getMouseState()
  })

  initSystemStateSubscribe()
}
