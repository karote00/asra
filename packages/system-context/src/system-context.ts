import { createAllAPIs } from './apis'
import { systemState, primaryToolState, mouseState } from './states'
import { initSystemContextSubscribe } from './subscribe'
import {
  HandlerDeps,
  PrimaryToolStateAPIs,
  MouseStateAPIs,
  SystemStateAPIs,
  SystemContextAPIs,
  RootAPIs
} from './types'

export class SystemContext implements SystemContextAPIs {
  getCurrentPrimaryTool!: PrimaryToolStateAPIs['getCurrentPrimaryTool']
  switchPrimaryTool!: PrimaryToolStateAPIs['switchPrimaryTool']

  updateMouseState!: MouseStateAPIs['updateMouseState']
  getMouseState!: MouseStateAPIs['getMouseState']

  getSystemMode!: SystemStateAPIs['getSystemMode']

  getSystemSnapshot!: RootAPIs['getSystemSnapshot']

  constructor(private deps: HandlerDeps) {
    const apis = createAllAPIs(deps)

    initSystemContextSubscribe(apis)

    Object.assign(this, apis)
  }
}

const systemContext = new SystemContext({
  systemState,
  primaryToolState,
  mouseState
})
export default systemContext
