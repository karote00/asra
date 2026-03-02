import {
  MouseData,
  MouseButton,
  SpecialEvent,
  InputField,
  ModifierKeys,
  RawInputEvent,
  InputType,
  ModifierKey,
  KeyboardKey,
  arrEqual,
  PointerEventData,
  DefaultPointerEventData
} from '@asyra/utils'
import { InputFieldsList } from '@asyra/utils'
import { PointerKey } from '@asyra/utils'
import { CLICK_THRESHOLD, CLEAR_KEY_TIME } from './constants'
import { InputEventCombo } from './event-mappings'
import { InputSystemRegistry } from './registry'
import keymap, { KeyMap } from './keymap'

type Callback = (raw: RawInputEvent) => void | Promise<void>
type Combinations = Record<string, string[]>

const WHEEL_EVENT_OPTIONS: AddEventListenerOptions = { passive: false }

const getMouseButton = (button: number): MouseButton => {
  switch (button) {
    case 0:
      return MouseButton.LEFT
    case 1:
      return MouseButton.MIDDLE
    case 2:
      return MouseButton.RIGHT
    default:
      return MouseButton.NONE
  }
}

const getMouseButtonFromButtonsMask = (buttons: number): MouseButton => {
  if ((buttons & 1) === 1) {
    return MouseButton.LEFT
  }

  if ((buttons & 4) === 4) {
    return MouseButton.MIDDLE
  }

  if ((buttons & 2) === 2) {
    return MouseButton.RIGHT
  }

  return MouseButton.NONE
}

class InputSystem {
  private _previousWatchedElement: Window | HTMLElement
  private combinations: Combinations = {}
  private keyMap: KeyMap
  private activeKeys: Set<string>
  private listeners: Map<string, Callback[]>
  private timers: Map<string, NodeJS.Timeout>
  private _startPos: MouseData | null
  public registry: InputSystemRegistry

  constructor() {
    this._previousWatchedElement = window
    this.keyMap = keymap
    this.activeKeys = new Set()
    this.listeners = new Map()
    this.timers = new Map()
    this._startPos = null
    this.registry = new InputSystemRegistry()

    this.setupListeners()
  }

  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('mousemove', this.handleMouseMove)
    window.addEventListener('dblclick', this.handleDoubleClick)
    window.addEventListener('wheel', this.handleWheel, WHEEL_EVENT_OPTIONS)
    window.addEventListener('contextmenu', (e: MouseEvent) =>
      e.preventDefault()
    )
  }

  setCombinations(combinations: Combinations) {
    this.combinations = combinations
  }

  on(action: string, callback: Callback): this {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, [])
    }
    this.listeners.get(action)?.push(callback)
    return this
  }

  switchWatchedElement(watchedElement: HTMLElement) {
    this._previousWatchedElement.removeEventListener(
      'mousedown',
      this.handleMouseDown as EventListener
    )
    this._previousWatchedElement.removeEventListener(
      'mouseup',
      this.handleMouseUp as EventListener
    )
    this._previousWatchedElement.removeEventListener(
      'mousemove',
      this.handleMouseMove as EventListener
    )
    this._previousWatchedElement.removeEventListener(
      'dblclick',
      this.handleDoubleClick as EventListener
    )
    this._previousWatchedElement.removeEventListener(
      'wheel',
      this.handleWheel as EventListener,
      WHEEL_EVENT_OPTIONS
    )

    watchedElement.addEventListener('mousedown', this.handleMouseDown)
    watchedElement.addEventListener('mouseup', this.handleMouseUp)
    watchedElement.addEventListener('mousemove', this.handleMouseMove)
    watchedElement.addEventListener('dblclick', this.handleDoubleClick)
    watchedElement.addEventListener('wheel', this.handleWheel, {
      passive: false
    })

    this._previousWatchedElement = watchedElement
  }

  private startTimer(key: string) {
    if (this.timers.has(key)) {
      const currentTimer = this.timers.get(key)
      if (currentTimer) {
        clearTimeout(currentTimer)
      }
    }

    const timer = setTimeout(() => {
      this.activeKeys.delete(key)
      this.timers.delete(key)
    }, CLEAR_KEY_TIME)
    this.timers.set(key, timer)
  }

  private clearTimer(key: string) {
    if (this.timers.has(key)) {
      const currentTimer = this.timers.get(key)
      if (currentTimer) {
        clearTimeout(currentTimer)
      }
      this.timers.delete(key)
    }
  }

  private _isInputActive(event: KeyboardEvent) {
    return (
      InputFieldsList.includes(
        (event.target as HTMLElement).tagName.toLowerCase() as InputField
      ) || (event.target as HTMLElement).isContentEditable
    )
  }

  private _hasTriggerBrowserShortcut(event: KeyboardEvent) {
    const hasMeta = this.activeKeys.has('Meta')
    const key = this.keyMap.mapKey(event.code)
    const hasNumber = !isNaN(Number(key))
    return hasMeta && hasNumber
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!this._isInputActive(event) || this._hasTriggerBrowserShortcut(event)) {
      event.preventDefault()
    }

    const key = this.keyMap.mapKey(event.code)
    if (key) {
      this.activeKeys.add(key)
      if (!this.keyMap.isModifierKeys(key)) {
        this.startTimer(key)
      }

      this.checkCombinations(InputType.KEYBOARD)
    }
  }

  private handleKeyUp = (event: KeyboardEvent) => {
    if (!this._isInputActive(event) || this._hasTriggerBrowserShortcut(event)) {
      event.preventDefault()
    }

    const key = this.keyMap.mapKey(event.code)
    if (key) {
      this.activeKeys.delete(key)
      this.clearTimer(key)

      this.checkCombinations(InputType.KEYBOARD)
    }
  }

  private handleMouseDown = (event: MouseEvent) => {
    const button = getMouseButton(event.button)
    const key = this.getMouseEventKey(button, 'Down')

    if (key) {
      this._startPos = {
        clientX: event.clientX,
        clientY: event.clientY
      }
      this.activeKeys.add(key)

      this.checkCombinations(InputType.POINTER, {
        ...DefaultPointerEventData,
        ...this._startPos,
        button
      })
    }
  }

  private handleMouseUp = (event: MouseEvent) => {
    const button = getMouseButton(event.button)
    const key = this.getMouseEventKey(button, 'Up')

    if (key) {
      this.activeKeys.add(key)
      this.activeKeys.delete(key.replace('Up', 'Down'))

      this.checkCombinations(InputType.POINTER, {
        ...DefaultPointerEventData,
        clientX: event.clientX,
        clientY: event.clientY,
        button
      })

      // No need to keep mouse up key after trigger action
      this.activeKeys.delete(key)
    }
  }

  private handleMouseMove = (event: MouseEvent) => {
    const buttonFromMask = getMouseButtonFromButtonsMask(event.buttons)
    const button =
      buttonFromMask !== MouseButton.NONE
        ? buttonFromMask
        : getMouseButton(event.button)
    const key = this.getMouseEventKey(button, 'Move')

    if (key) {
      let canMove = true
      if (this._startPos) {
        const dx = event.clientX - this._startPos.clientX
        const dy = event.clientY - this._startPos.clientY
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < CLICK_THRESHOLD) {
          canMove = false
        }
      }

      if (canMove) {
        this.activeKeys.add(key)

        this.checkCombinations(InputType.POINTER, {
          ...DefaultPointerEventData,
          clientX: event.clientX,
          clientY: event.clientY,
          button
        })

        // No need to keep mouse up key after trigger action
        this.activeKeys.delete(key)
      }
    }
  }

  private handleDoubleClick = (event: MouseEvent) => {
    const button = getMouseButton(event.button)
    this.activeKeys.add(PointerKey.MOUSE_DOUBLE_CLICK)

    this.checkCombinations(InputType.POINTER, {
      ...DefaultPointerEventData,
      clientX: event.clientX,
      clientY: event.clientY,
      button
    })

    this.activeKeys.delete(PointerKey.MOUSE_DOUBLE_CLICK)
  }

  private getMouseEventKey(
    button: MouseButton,
    state: string
  ): string | undefined {
    if (button === MouseButton.NONE) return

    return `${button}Mouse${state}`
  }

  private checkCombinations(
    type: InputType,
    pointerData: PointerEventData = DefaultPointerEventData
  ) {
    const currentKeys = Array.from(this.activeKeys).filter(
      (key) => !this.keyMap.isModifierKeys(key)
    )
    const activeModifiers = this.getActiveModifiers(this.activeKeys)
    const allModifiers = this.getAllModifiers(activeModifiers)
    for (const eventName of this.registry.getEventNames()) {
      const combos = this.registry.getCombinations(eventName)
      if (!combos) continue

      for (const combo of combos) {
        if (this.isExactMatch(type, currentKeys, combo, activeModifiers)) {
          const raw: RawInputEvent = {
            type,
            keys: currentKeys,
            modifiers: allModifiers,
            pointer: pointerData
          }
          if (combo.detail) {
            raw.detail = combo.detail
          }

          // Call callback before triggering action (if defined)
          if (combo.callback) {
            combo.callback(raw)
          }

          this.triggerAction(eventName, raw)
        }
      }
    }
  }

  private isExactMatch(
    type: InputType,
    keys: KeyboardKey[],
    combo: InputEventCombo,
    modifiers: ModifierKey[]
  ): boolean {
    const isKeysMatch = arrEqual(keys, combo.keys)
    if (type !== combo.type || !isKeysMatch) return false
    if (isKeysMatch && (!combo.modifiers || !combo.modifiers.length)) {
      return true
    }

    return combo?.modifiers
      ? combo.modifiers.every((m) => modifiers.includes(m))
      : true
  }

  private triggerAction(event: string, raw: RawInputEvent) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((cb) => {
        const result = cb(raw)
        // If callback returns a promise, catch any errors
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error('Error in async input system callback:', error)
          })
        }
      })
    }
  }

  private handleWheel = (event: WheelEvent) => {
    const deltaX = event.deltaX
    const deltaY = event.deltaY

    if (this.keyMap.isSpecialEvent(SpecialEvent.WHEEL)) {
      event.preventDefault()
      const key = SpecialEvent.WHEEL
      this.activeKeys.add(key)

      const wheelData: PointerEventData = {
        deltaX,
        deltaY,
        deltaZ: event.deltaZ,
        clientX: event.clientX,
        clientY: event.clientY,
        button: MouseButton.MIDDLE
      }

      this.checkCombinations(InputType.WHEEL, wheelData)

      // Remove wheel key immediately as scrolling is continuous
      this.activeKeys.delete(key)
    }
  }

  getActiveModifiers(keys: Set<string>): ModifierKey[] {
    const modifiers: ModifierKey[] = []

    keys.forEach((key) => {
      if (this.keyMap.isModifierKeys(key)) {
        modifiers.push(key.toLocaleLowerCase() as ModifierKey)
      }
    })

    return modifiers
  }

  getAllModifiers(modifiers: ModifierKey[]): ModifierKeys {
    const allModifiers: ModifierKeys = {
      meta: false,
      ctrl: false,
      alt: false,
      shift: false
    }

    modifiers.forEach((m) => {
      allModifiers[m] = true
    })

    return allModifiers
  }

  dispose() {
    this.listeners.clear()
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()
    this.activeKeys.clear()
    this.combinations = {}
  }

  reset() {
    this.dispose()
  }
}

export { InputSystem }

const inputSystem = new InputSystem()
export default inputSystem
