import { createAllAPIs } from './apis/index.js'
import { managedPropertyState } from './states/index.js'
import {
  HandlerDeps,
  SystemContextAPIs,
  RootAPIs,
  ManagedPropertyStateAPIs
} from './types/index.js'

export class SystemContext implements SystemContextAPIs {
  getSystemContextSnapshot!: RootAPIs['getSystemContextSnapshot']

  registerProperty!: ManagedPropertyStateAPIs['registerProperty']
  getManagedProperty!: ManagedPropertyStateAPIs['getManagedProperty']
  setManagedProperty!: ManagedPropertyStateAPIs['setManagedProperty']
  getManagedPropertyObservable!: ManagedPropertyStateAPIs['getManagedPropertyObservable']
  hasManagedProperty!: ManagedPropertyStateAPIs['hasManagedProperty']
  unregisterProperty!: ManagedPropertyStateAPIs['unregisterProperty']
  validateManagedProperties!: ManagedPropertyStateAPIs['validateManagedProperties']
  applyValidatedManagedProperties!: ManagedPropertyStateAPIs['applyValidatedManagedProperties']
  loadManagedProperties!: ManagedPropertyStateAPIs['loadManagedProperties']
  saveManagedProperties!: ManagedPropertyStateAPIs['saveManagedProperties']

  constructor(deps: HandlerDeps) {
    const apis = createAllAPIs(deps)

    Object.assign(this, apis)
  }
}

const systemContext = new SystemContext({
  managedPropertyState
})
export default systemContext
