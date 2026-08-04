import inputSystem, { InputSystem } from './input-system.js'
import { InputSystemRegistry } from './registry.js'
import { InputEventCombo } from './event-mappings.js'
import keyMap from './keymap.js'
import { initInputSystemSubscribe } from './subscribe.js'

initInputSystemSubscribe()

export { InputSystem, InputSystemRegistry, InputEventCombo, keyMap }
export default inputSystem
