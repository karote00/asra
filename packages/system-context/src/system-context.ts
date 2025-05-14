import { createAllAPIs } from './apis'
import { primaryToolState } from './states'
import { initSystemContextSubscribe } from './subscribe'
import { HandlerDeps, SystemContextAPIs } from './types'
import { PrimaryToolAPIs } from './types/primary-tool'

export class SystemContext implements SystemContextAPIs {
  getCurrentPrimaryTool!: PrimaryToolAPIs['getCurrentPrimaryTool']
  switchPrimaryTool!: PrimaryToolAPIs['switchPrimaryTool']

  constructor(deps: HandlerDeps) {
    const apis = createAllAPIs(deps)

    initSystemContextSubscribe(apis)

    Object.assign(this, apis)
  }
}

const systemContext = new SystemContext({
  primaryToolState
})
export default systemContext
