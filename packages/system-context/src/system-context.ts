import { createAllAPIs } from './apis'
import { managedPropertyState } from './states'
import {
  HandlerDeps,
  SystemContextAPIs,
  RootAPIs,
  ManagedPropertyStateAPIs
} from './types'

export class SystemContext implements SystemContextAPIs {
  getSystemContextSnapshot!: RootAPIs['getSystemContextSnapshot']

  registerProperty!: ManagedPropertyStateAPIs['registerProperty']
  getManagedProperty!: ManagedPropertyStateAPIs['getManagedProperty']
  setManagedProperty!: ManagedPropertyStateAPIs['setManagedProperty']
  getManagedPropertyObservable!: ManagedPropertyStateAPIs['getManagedPropertyObservable']
  hasManagedProperty!: ManagedPropertyStateAPIs['hasManagedProperty']
  unregisterProperty!: ManagedPropertyStateAPIs['unregisterProperty']
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
