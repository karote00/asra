import { createAllAPIs } from './apis'
import { systemState, primaryToolState, mouseState, keyState } from './states'
import { initSystemContextSubscribe } from './subscribe'
import {
  HandlerDeps,
  PrimaryToolStateAPIs,
  MouseStateAPIs,
  SystemStateAPIs,
  SystemContextAPIs,
  RootAPIs,
  KeyStateAPIs
} from './types'

export class SystemContext implements SystemContextAPIs {
  getSystemMode!: SystemStateAPIs['getSystemMode']

  getCurrentPrimaryTool!: PrimaryToolStateAPIs['getCurrentPrimaryTool']
  switchPrimaryTool!: PrimaryToolStateAPIs['switchPrimaryTool']

  getMouseState!: MouseStateAPIs['getMouseState']
  updateMouseState!: MouseStateAPIs['updateMouseState']

  getKeyState!: KeyStateAPIs['getKeyState']
  updateKeyState!: KeyStateAPIs['updateKeyState']

  getSystemContextSnapshot!: RootAPIs['getSystemContextSnapshot']

  constructor(private deps: HandlerDeps) {
    const apis = createAllAPIs(deps)

    initSystemContextSubscribe(apis)

    Object.assign(this, apis)
  }
}

const systemContext = new SystemContext({
  systemState,
  primaryToolState,
  mouseState,
  keyState
})
export default systemContext
