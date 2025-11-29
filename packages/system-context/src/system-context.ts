import { createAllAPIs } from './apis'
import { systemState, primaryToolState, mouseState, keyState, targetState } from './states'
import { initSystemContextSubscribe } from './subscribe'
import {
  HandlerDeps,
  PrimaryToolStateAPIs,
  MouseStateAPIs,
  SystemStateAPIs,
  SystemContextAPIs,
  RootAPIs,
  KeyStateAPIs,
  TargetStateAPIs
} from './types'

export class SystemContext implements SystemContextAPIs {
  getSystemMode!: SystemStateAPIs['getSystemMode']

  getCurrentPrimaryTool!: PrimaryToolStateAPIs['getCurrentPrimaryTool']
  switchPrimaryTool!: PrimaryToolStateAPIs['switchPrimaryTool']

  getMouseState!: MouseStateAPIs['getMouseState']
  updateMouseState!: MouseStateAPIs['updateMouseState']

  getKeyState!: KeyStateAPIs['getKeyState']
  updateKeyState!: KeyStateAPIs['updateKeyState']

  getTargetState!: TargetStateAPIs['getTargetState']
  updateHoveredElementId!: TargetStateAPIs['updateHoveredElementId']

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
  keyState,
  targetState
})
export default systemContext
