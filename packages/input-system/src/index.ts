import inputSystem, { InputSystem } from './input-system'
import { InputSystemRegistry } from './registry'
import { InputEventCombo } from './event-mappings'
import { initInputSystemSubscribe } from './subscribe'

initInputSystemSubscribe()

export { InputSystem, InputSystemRegistry, InputEventCombo }
export default inputSystem
