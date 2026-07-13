import { InputType, KeyboardKey, ModifierKey, DetailType } from '@asyra/utils'
import type { RawInputEvent } from '@asyra/utils'

/**
 * Defines a single input combination that can trigger an event.
 *
 * This interface is part of the framework's type system. Users create instances
 * of this type and register them with the InputSystemRegistry.
 *
 * @example Keyboard shortcut
 * const combo: InputEventCombo = {
 *   type: InputType.KEYBOARD,
 *   keys: [keyMap.keys.KeyZ],
 *   modifiers: [ModifierKey.META]
 * }
 *
 * @example Mouse drag
 * const combo: InputEventCombo = {
 *   type: InputType.POINTER,
 *   keys: [PointerKey.LEFT_MOUSE_DOWN]
 * }
 *
 * @example With callback to update system context
 * const combo: InputEventCombo = {
 *   type: InputType.POINTER,
 *   keys: [PointerKey.LEFT_MOUSE_DOWN],
 *   callback: (raw: RawInputEvent) => {
 *     core.setSystemProperty('mousePosition', { x: raw.pointer.clientX, y: raw.pointer.clientY })
 *   }
 * }
 *
 * @example Custom device
 * const combo: InputEventCombo = {
 *   type: 'voice.command',  // Custom InputType
 *   keys: ['create rectangle']
 * }
 */
export interface InputEventCombo {
  type: InputType
  keys: KeyboardKey[]
  modifiers?: ModifierKey[]
  detail?: DetailType
  callback?: (raw: RawInputEvent) => void
}
