import { createAllAPIs } from './apis'
import {
  systemState,
  primaryToolState,
  mouseState,
  keyState,
  targetState,
  managedPropertyState
} from './states'
import { initSystemContextSubscribe } from './subscribe'
import {
  HandlerDeps,
  PrimaryToolStateAPIs,
  MouseStateAPIs,
  SystemStateAPIs,
  SystemContextAPIs,
  RootAPIs,
  KeyStateAPIs,
  TargetStateAPIs,
  ManagedPropertyStateAPIs
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

  registerProperty!: ManagedPropertyStateAPIs['registerProperty']
  getManagedProperty!: ManagedPropertyStateAPIs['getManagedProperty']
  setManagedProperty!: ManagedPropertyStateAPIs['setManagedProperty']
  getManagedPropertyObservable!: ManagedPropertyStateAPIs['getManagedPropertyObservable']
  loadManagedProperties!: ManagedPropertyStateAPIs['loadManagedProperties']
  saveManagedProperties!: ManagedPropertyStateAPIs['saveManagedProperties']

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
  targetState,
  managedPropertyState
})
export default systemContext
