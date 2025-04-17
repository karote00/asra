import { WheelEventData } from '@asra/utils'
import KeyMap from './keymap'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callback = (data?: any) => void

const CLEAR_KEY_TIME = 100

class InputSystem {
  private combinations: Record<string, string[]>
  private keyMap: KeyMap
  private activeKeys: Set<string>
  private listeners: Map<string, Callback[]>
  private timers: Map<string, NodeJS.Timeout>

  constructor(combinations: Record<string, string[]>) {
    this.combinations = combinations
    this.keyMap = new KeyMap()
    this.activeKeys = new Set()
    this.listeners = new Map()
    this.timers = new Map()

    this.setupListeners()
  }

  private setupListeners() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e))
    window.addEventListener('keyup', (e) => this.handleKeyUp(e))
    window.addEventListener('mousedown', (e) => this.handleMouseDown(e))
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e))
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e))
    window.addEventListener('wheel', (e) => this.handleWheel(e), {
      passive: false
    })
  }

  on(action: string, callback: Callback): this {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, [])
    }
    this.listeners.get(action)?.push(callback)
    return this
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
      ['INPUT', 'TEXT', 'TEXTAREA'].includes(
        (event.target as HTMLElement).tagName
      ) || (event.target as HTMLElement).isContentEditable
    )
  }

  private _hasTriggerBrowserShortcut(event: KeyboardEvent) {
    const hasMeta = this.activeKeys.has('Meta')
    const key = this.keyMap.mapKey(event.code)
    const hasNumber = !isNaN(Number(key))
    return hasMeta && hasNumber
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (!this._isInputActive(event) || this._hasTriggerBrowserShortcut(event)) {
      event.preventDefault()
    }

    const key = this.keyMap.mapKey(event.code)
    if (key) {
      this.activeKeys.add(key)
      if (!this.keyMap.isModifiers(key)) {
        this.startTimer(key)
      }
      this.checkCombinations()
    }
  }

  private handleKeyUp(event: KeyboardEvent) {
    if (!this._isInputActive(event) || this._hasTriggerBrowserShortcut(event)) {
      event.preventDefault()
    }

    const key = this.keyMap.mapKey(event.code)
    if (key) {
      this.activeKeys.delete(key)
      this.clearTimer(key)
      this.checkCombinations()
    }
  }

  private handleMouseDown(event: MouseEvent) {
    const key = this.getMouseEventKey(event, 'Down')

    if (key) {
      this.activeKeys.add(key)
      this.checkCombinations()
    }
  }

  private handleMouseUp(event: MouseEvent) {
    const key = this.getMouseEventKey(event, 'Up')

    if (key) {
      this.activeKeys.add(key)
      this.activeKeys.delete(key.replace('Up', 'Down'))
      this.checkCombinations()

      // No need to keep mouse up key after trigger action
      this.activeKeys.delete(key)
    }
  }

  private handleMouseMove(event: MouseEvent) {
    const key = this.getMouseEventKey(event, 'Move')

    if (key) {
      this.activeKeys.add(key)
      this.checkCombinations()

      // No need to keep mouse up key after trigger action
      this.activeKeys.delete(key)
    }
  }

  private getMouseEventKey(
    event: MouseEvent,
    state: string
  ): string | undefined {
    switch (event.button) {
      case 0:
        return `LeftMouse${state}`
      case 1:
        return `MiddleMouse${state}`
      case 2:
        return `RightMouse${state}`
      default:
        return undefined
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private checkCombinations(data?: any) {
    const currentKeys = Array.from(this.activeKeys)

    for (const [action, requiredKeys] of Object.entries(this.combinations)) {
      if (this.isExactMatch(currentKeys, requiredKeys)) {
        this.triggerAction(action, data)
      }
    }
  }

  private isExactMatch(currentKeys: string[], requiredKeys: string[]): boolean {
    return (
      currentKeys.length === requiredKeys.length &&
      requiredKeys.every((key) => currentKeys.includes(key))
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private triggerAction(action: string, data?: any) {
    const callbacks = this.listeners.get(action)
    if (callbacks) {
      callbacks.forEach((cb) => cb(data))
    }
  }

  private handleWheel(event: WheelEvent) {
    const deltaX = event.deltaX
    const deltaY = event.deltaY

    if (this.keyMap.isSpecialEvent('Wheel')) {
      event.preventDefault()
      this.activeKeys.add('Wheel')

      const wheelData = {
        deltaX,
        deltaY,
        deltaZ: event.deltaZ,
        clientX: event.clientX,
        clientY: event.clientY
      } as WheelEventData

      this.checkCombinations(wheelData)

      // Remove wheel key immediately as scrolling is continuous
      this.activeKeys.delete('Wheel')
    }
  }
}

export default InputSystem
