import { MouseEventData, WheelEventData } from '@asra/utils'
import KeyMap from './keymap'
import { CLICK_THRESHOLD } from './constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Callback = (data?: any) => void
type Combinations = Record<string, string[]>

const CLEAR_KEY_TIME = 100

const WHEEL_EVENT_OPTIONS: AddEventListenerOptions = { passive: false }

class InputSystem {
  private _privateWatchedElement: Window | HTMLElement
  private combinations: Combinations = {}
  private keyMap: KeyMap
  private activeKeys: Set<string>
  private listeners: Map<string, Callback[]>
  private timers: Map<string, NodeJS.Timeout>
  private _startPos: MouseEventData | null

  constructor() {
    this._privateWatchedElement = window
    this.keyMap = new KeyMap()
    this.activeKeys = new Set()
    this.listeners = new Map()
    this.timers = new Map()
    this._startPos = null

    this.setupListeners()
  }

  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('mouseup', this.handleMouseUp)
    window.addEventListener('mousemove', this.handleMouseMove)
    window.addEventListener('wheel', this.handleWheel, WHEEL_EVENT_OPTIONS)
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
    this._privateWatchedElement.removeEventListener(
      'mousedown',
      this.handleMouseDown as EventListener
    )
    this._privateWatchedElement.removeEventListener(
      'mouseup',
      this.handleMouseUp as EventListener
    )
    this._privateWatchedElement.removeEventListener(
      'mousemove',
      this.handleMouseMove as EventListener
    )
    this._privateWatchedElement.removeEventListener(
      'wheel',
      this.handleWheel as EventListener,
      WHEEL_EVENT_OPTIONS
    )

    watchedElement.addEventListener('mousedown', this.handleMouseDown)
    watchedElement.addEventListener('mouseup', this.handleMouseUp)
    watchedElement.addEventListener('mousemove', this.handleMouseMove)
    watchedElement.addEventListener('wheel', this.handleWheel, {
      passive: false
    })
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

  private handleKeyDown = (event: KeyboardEvent) => {
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

  private handleKeyUp = (event: KeyboardEvent) => {
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

  private handleMouseDown = (event: MouseEvent) => {
    const key = this.getMouseEventKey(event, 'Down')

    if (key) {
      this._startPos = {
        clientX: event.clientX,
        clientY: event.clientY
      }
      this.activeKeys.add(key)
      this.checkCombinations(this._startPos)
    }
  }

  private handleMouseUp = (event: MouseEvent) => {
    const key = this.getMouseEventKey(event, 'Up')

    if (key) {
      this.activeKeys.add(key)
      this.activeKeys.delete(key.replace('Up', 'Down'))
      this.checkCombinations({
        clientX: event.clientX,
        clientY: event.clientY
      } as MouseEventData)

      // No need to keep mouse up key after trigger action
      this.activeKeys.delete(key)
    }
  }

  private handleMouseMove = (event: MouseEvent) => {
    const key = this.getMouseEventKey(event, 'Move')

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
        this.checkCombinations({
          clientX: event.clientX,
          clientY: event.clientY
        } as MouseEventData)

        // No need to keep mouse up key after trigger action
        this.activeKeys.delete(key)
      }
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

  private handleWheel = (event: WheelEvent) => {
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

export { InputSystem }

const inputSystem = new InputSystem()
export default inputSystem
