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
  DefaultPointerEventData,
  measureBrowserDragPhase
} from '@asyra/utils'
import { InputFieldsList } from '@asyra/utils'
import { PointerKey } from '@asyra/utils'
import { CLICK_THRESHOLD, CLEAR_KEY_TIME } from './constants.js'
import { InputEventCombo } from './event-mappings.js'
import { InputSystemRegistry } from './registry.js'
import keymap, { KeyMap } from './keymap.js'

type Callback = (raw: RawInputEvent) => void | Promise<void>
type Combinations = Record<string, string[]>

const WHEEL_EVENT_OPTIONS: AddEventListenerOptions = { passive: false }
const POINTER_KEYS = new Set<string>(Object.values(PointerKey))

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
  private browserHost: Window | null
  private pointerTarget: Window | HTMLElement | null
  private combinations: Combinations = {}
  private keyMap: KeyMap
  private activeKeys: Set<string>
  private listeners: Map<string, Callback[]>
  private timers: Map<string, NodeJS.Timeout>
  private _startPos: MouseData | null
  private pointerInputBlocked: boolean
  private pointerCaptureId: string | null
  public registry: InputSystemRegistry
  private runtimeGeneration = 0
  private browserListeners = new Map<EventListener, EventListener>()

  constructor() {
    this.browserHost = null
    this.pointerTarget = null
    this.keyMap = keymap
    this.activeKeys = new Set()
    this.listeners = new Map()
    this.timers = new Map()
    this._startPos = null
    this.pointerInputBlocked = false
    this.pointerCaptureId = null
    this.registry = new InputSystemRegistry()
  }

  attachBrowserHost(
    host: Window,
    pointerTarget: Window | HTMLElement = host
  ): void {
    if (this.browserHost === host && this.pointerTarget === pointerTarget) {
      return
    }

    if (this.pointerTarget && this.pointerTarget !== pointerTarget) {
      this.removePointerListeners(this.pointerTarget)
      this.pointerTarget = null
    }

    if (this.browserHost && this.browserHost !== host) {
      this.removeKeyboardListeners(this.browserHost)
      this.browserHost = null
    }

    if (!this.browserHost) {
      this.addKeyboardListeners(host)
      this.browserHost = host
    }

    if (!this.pointerTarget) {
      this.addPointerListeners(pointerTarget)
      this.pointerTarget = pointerTarget
    }
  }

  detachBrowserHost(): void {
    if (this.pointerTarget) {
      this.removePointerListeners(this.pointerTarget)
      this.pointerTarget = null
    }
    if (this.browserHost) {
      this.removeKeyboardListeners(this.browserHost)
      this.browserHost = null
    }
  }

  private addKeyboardListeners(host: Window): void {
    this.keyboardBindings().forEach(([name, listener]) =>
      host.addEventListener(name, listener)
    )
  }

  private removeKeyboardListeners(
    host: Window,
    attempt = (cleanup: () => void) => cleanup()
  ): void {
    this.keyboardBindings().forEach(([name, listener]) =>
      attempt(() => host.removeEventListener(name, listener))
    )
  }

  private addPointerListeners(target: Window | HTMLElement): void {
    this.pointerBindings().forEach((binding) =>
      target.addEventListener(...binding)
    )
  }

  private removePointerListeners(
    target: Window | HTMLElement,
    attempt = (cleanup: () => void) => cleanup()
  ): void {
    this.pointerBindings().forEach((binding) =>
      attempt(() => target.removeEventListener(...binding))
    )
  }

  private keyboardBindings(): [string, EventListener][] {
    return [
      ['keydown', this.browserListener(this.handleKeyDown as EventListener)],
      ['keyup', this.browserListener(this.handleKeyUp as EventListener)]
    ]
  }

  private pointerBindings(): [
    string,
    EventListener,
    AddEventListenerOptions?
  ][] {
    return [
      [
        'mousedown',
        this.browserListener(this.handleMouseDown as EventListener)
      ],
      ['mouseup', this.browserListener(this.handleMouseUp as EventListener)],
      [
        'mousemove',
        this.browserListener(this.handleMouseMove as EventListener)
      ],
      [
        'dblclick',
        this.browserListener(this.handleDoubleClick as EventListener)
      ],
      [
        'wheel',
        this.browserListener(this.handleWheel as EventListener),
        WHEEL_EVENT_OPTIONS
      ]
    ]
  }

  private browserListener(listener: EventListener): EventListener {
    const existing = this.browserListeners.get(listener)
    if (existing) return existing
    const generation = this.runtimeGeneration
    const guarded: EventListener = (event) => {
      if (generation === this.runtimeGeneration) listener(event)
    }
    this.browserListeners.set(listener, guarded)
    return guarded
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

  off(action: string, callback: Callback): boolean {
    const callbacks = this.listeners.get(action)
    if (!callbacks) {
      return false
    }

    const index = callbacks.indexOf(callback)
    if (index < 0) {
      return false
    }

    callbacks.splice(index, 1)
    if (callbacks.length === 0) {
      this.listeners.delete(action)
    }
    return true
  }

  switchWatchedElement(watchedElement: HTMLElement): void {
    const host = watchedElement.ownerDocument.defaultView
    if (!host) {
      throw new Error(
        '[InputSystem] Watched element must belong to a document with a Window'
      )
    }
    this.attachBrowserHost(host, watchedElement)
  }

  private startTimer(key: string) {
    if (this.timers.has(key)) {
      const currentTimer = this.timers.get(key)
      if (currentTimer) {
        clearTimeout(currentTimer)
      }
    }

    const generation = this.runtimeGeneration
    const timer = setTimeout(() => {
      if (generation !== this.runtimeGeneration) return
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
    if (this.pointerInputBlocked) {
      return
    }

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
    if (this.pointerInputBlocked) {
      return
    }

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
    if (this.pointerInputBlocked) {
      return
    }

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

        measureBrowserDragPhase('input:pointer-move', () =>
          this.checkCombinations(InputType.POINTER, {
            ...DefaultPointerEventData,
            clientX: event.clientX,
            clientY: event.clientY,
            button
          })
        )

        // No need to keep mouse up key after trigger action
        this.activeKeys.delete(key)
      }
    }
  }

  private handleDoubleClick = (event: MouseEvent) => {
    if (this.pointerInputBlocked) {
      return
    }

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
    const currentKeys = Array.from(this.activeKeys).filter((key) => {
      if (this.keyMap.isModifierKeys(key)) {
        return false
      }
      if (type === InputType.KEYBOARD) {
        return !POINTER_KEYS.has(key)
      }
      if (type === InputType.WHEEL) {
        return key === SpecialEvent.WHEEL
      }
      return POINTER_KEYS.has(key) && key !== SpecialEvent.WHEEL
    })
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
        const result = measureBrowserDragPhase(`input:trigger:${event}`, () =>
          cb(raw)
        )
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

  setPointerCaptureBlock(active: boolean, captureId?: string | null) {
    if (active) {
      this.pointerInputBlocked = true
      this.pointerCaptureId = captureId ?? null
      this.clearPointerState()
      return
    }

    if (
      this.pointerCaptureId &&
      captureId &&
      this.pointerCaptureId !== captureId
    ) {
      return
    }

    this.pointerInputBlocked = false
    this.pointerCaptureId = null
    this.clearPointerState()
  }

  private clearPointerState() {
    this._startPos = null

    for (const key of Array.from(this.activeKeys)) {
      if (this.isPointerKey(key)) {
        this.activeKeys.delete(key)
        this.clearTimer(key)
      }
    }
  }

  private isPointerKey(key: string) {
    if (key === PointerKey.WHEEL) {
      return true
    }

    return key.toLowerCase().includes('mouse')
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

  private clearTransientState(): void {
    this.listeners.clear()
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()
    this.activeKeys.clear()
    this.combinations = {}
    this._startPos = null
    this.pointerInputBlocked = false
    this.pointerCaptureId = null
  }

  dispose() {
    this.detachBrowserHost()
    this.clearTransientState()
  }

  reset() {
    this.clearTransientState()
  }

  resetRuntime(): void {
    this.runtimeGeneration += 1
    const failures: unknown[] = []
    const attempt = (cleanup: () => void): void => {
      try {
        cleanup()
      } catch (error) {
        failures.push(error)
      }
    }
    if (this.pointerTarget)
      this.removePointerListeners(this.pointerTarget, attempt)
    if (this.browserHost)
      this.removeKeyboardListeners(this.browserHost, attempt)
    this.pointerTarget = null
    this.browserHost = null
    this.browserListeners.clear()
    this.clearTransientState()
    this.registry.clear()
    if (failures.length > 0) throw failures[0]
  }
}

export { InputSystem }

const inputSystem = new InputSystem()
export default inputSystem
