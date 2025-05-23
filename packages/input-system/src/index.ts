import inputSystem, { InputSystem } from './input-system'
import { initInputSystemSubscribe } from './subscribe'

initInputSystemSubscribe()

export * from './input-system-events'
export { InputSystem }
export default inputSystem
