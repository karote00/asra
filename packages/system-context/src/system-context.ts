import { MouseSnapshot } from '@asra/utils'
import { createAllAPIs } from './apis'
import { primaryToolState, mouseState } from './states'
import { initSystemContextSubscribe } from './subscribe'
import { HandlerDeps, SystemContextAPIs } from './types'
import { PrimaryToolAPIs } from './types/primary-tool'

export class SystemContext implements SystemContextAPIs {
  getCurrentPrimaryTool!: PrimaryToolAPIs['getCurrentPrimaryTool']
  switchPrimaryTool!: PrimaryToolAPIs['switchPrimaryTool']
  updateMouseState!: (mouseSnapshot: MouseSnapshot) => void

  constructor(deps: HandlerDeps) {
    const apis = createAllAPIs(deps)

    initSystemContextSubscribe(apis)

    Object.assign(this, apis)
  }
}

const systemContext = new SystemContext({
  primaryToolState,
  mouseState
})
export default systemContext
