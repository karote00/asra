import { KeySnapshot, MouseSnapshot, PrimaryToolType } from '@asra/utils'
import { initRootSubscribe } from './root'
import { initPrimaryToolStateSubscribe } from './primary-tool-state'
import { initMouseStateSubscribe } from './mouse-state'
import { initSystemStateSubscribe } from './system-state'
import { initKeyStateSubscribe } from './key-state'
import { SystemContextAPIs } from '../types'

export const initSystemContextSubscribe = (apis: SystemContextAPIs) => {
  initRootSubscribe({
    getSystemContextSnapshot: () => apis.getSystemContextSnapshot()
  })

  initSystemStateSubscribe()

  initPrimaryToolStateSubscribe({
    getCurrentPrimaryTool: () => apis.getCurrentPrimaryTool(),
    switchPrimaryTool: (tool: PrimaryToolType) => apis.switchPrimaryTool(tool)
  })

  initMouseStateSubscribe({
    getMouseState: () => apis.getMouseState(),
    updateMouseState: (mouseSnapshot: MouseSnapshot) =>
      apis.updateMouseState(mouseSnapshot)
  })

  initKeyStateSubscribe({
    getKeyState: () => apis.getKeyState(),
    updateKeyState: (keySnapshot: KeySnapshot) =>
      apis.updateKeyState(keySnapshot)
  })
}
