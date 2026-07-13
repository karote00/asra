import inputSystem, { InputSystem } from './input-system'
import { InputSystemRegistry } from './registry'
import { InputEventCombo } from './event-mappings'
import keyMap from './keymap'
import { initInputSystemSubscribe } from './subscribe'

initInputSystemSubscribe()

export { InputSystem, InputSystemRegistry, InputEventCombo, keyMap }
export default inputSystem
