import EventEmitter from '@asra/event-emitter'
import { KeyMap } from './keymap'

interface EventCombination {
  keys: string[]
  modifiers: string[]
  mouse?: string[]
}

type CombinationConfig = Record<string, EventCombination>

interface MousePosition {
  x: number
  y: number
}

const MODIFIER_KEYS: Set<string> = new Set(['Control', 'Meta', 'Shift', 'Alt'])

interface ModifierKeys {
  Ctrl: boolean
  Meta: boolean
  Shift: boolean
  Alt: boolean
}

interface EmitContext {
  mousePos: MousePosition
  dragStart: MousePosition
  modifiers: ModifierKeys
}

const normalizeKey = (eventKey: string): string => {
  return eventKey.length === 1 ? eventKey.toUpperCase() : eventKey
}

const getPosition = (target: MousePosition) => ({
  x: target?.x ?? 0,
  y: target?.y ?? 0
})

class InputSystem extends EventEmitter {
  private activeKeys: Set<string> = new Set()
  private activeModifiers: Set<string> = new Set()
  private activeMouse: string | null = null
  private dragStartPosition: MousePosition | null = null
  private mousePosition: MousePosition | null = null
  private modifiers: ModifierKeys = {
    Ctrl: false,
    Meta: false,
    Shift: false,
    Alt: false
  }
  private canDrag: boolean = false
  private combinations: CombinationConfig = {}
  private keyTimeouts: Record<string, number> = {}
  private resetDelay: number = 100

  constructor(combinations: CombinationConfig) {
    super()
    this.combinations = combinations
    this.initEventListeners()
  }

  private initEventListeners() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e))
    document.addEventListener('keyup', (e) => this.onKeyUp(e))
    document.addEventListener('mousedown', (e) => this.onMouseDown(e))
    document.addEventListener('mousemove', (e) => this.onMouseMove(e))
    document.addEventListener('mouseup', () => this.onMouseUp())
    document.addEventListener('wheel', (e) => this.onMouseWheel(e))
    document.addEventListener('dblclick', (e) => this.onMouseDoubleClick(e))
  }

  private onKeyDown(event: KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()

    const key = normalizeKey(event.key)
    const standardKey = KeyMap[key] || key

    if (this.keyTimeouts[standardKey]) {
      clearTimeout(this.keyTimeouts[standardKey])
    }

    if (MODIFIER_KEYS.has(standardKey)) {
      this.activeModifiers.add(standardKey)
      this.updateModifiers()
    } else {
      this.activeKeys.add(standardKey)
      this.keyTimeouts[standardKey] = window.setTimeout(() => {
        this.activeKeys.delete(standardKey)
        this.activeModifiers.delete(standardKey)
        delete this.keyTimeouts[standardKey]
        this.updateModifiers()
        this.checkCombinations()
      }, this.resetDelay)
    }
    this.checkCombinations()
  }

  private onKeyUp(event: KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()

    const key = normalizeKey(event.key)
    const standardKey = KeyMap[key] || key

    if (this.keyTimeouts[standardKey]) {
      clearTimeout(this.keyTimeouts[standardKey])
      delete this.keyTimeouts[standardKey]
    }

    this.activeKeys.delete(standardKey)
    this.activeModifiers.delete(standardKey)
    this.updateModifiers()
    this.checkCombinations()
  }

  private updateModifiers() {
    this.modifiers = {
      Ctrl: this.activeModifiers.has('Control'),
      Meta: this.activeModifiers.has('Meta'),
      Shift: this.activeModifiers.has('Shift'),
      Alt: this.activeModifiers.has('Alt')
    }
  }

  private onMouseWheel(event: WheelEvent) {
    this.activeMouse = event.deltaY > 0 ? 'MouseWheelDown' : 'MouseWheelUp'
    this.checkCombinations()
  }

  private onMouseDoubleClick(event: MouseEvent) {
    this.activeMouse = 'MouseDoubleClick'
    this.checkCombinations()
  }

  private updateMousePosition(event: MouseEvent) {
    this.mousePosition = { x: event.clientX, y: event.clientY }
  }

  private onMouseDown(event: MouseEvent) {
    this.activeMouse =
      event.button === 0
        ? 'MouseLeft'
        : event.button === 2
          ? 'MouseRight'
          : 'MouseMiddle'
    this.activeKeys.add('MouseDown')
    this.canDrag = true
    this.dragStartPosition = { x: event.clientX, y: event.clientY }
    this.updateMousePosition(event)
    this.checkCombinations()
  }

  private onMouseMove(event: MouseEvent) {
    this.updateMousePosition(event)
    if (
      this.activeKeys.has('MouseDown') &&
      this.activeMouse === 'MouseLeft' &&
      this.dragStartPosition
    ) {
      const dx = event.clientX - this.dragStartPosition.x
      const dy = event.clientY - this.dragStartPosition.y
      this.deltaPosition = { x: dx, y: dy }
      this.checkCombinations()
    }
  }

  private onMouseUp() {
    this.activeKeys.delete('MouseDown')
    this.activeMouse = null
    this.canDrag = false
    this.dragStartPosition = null
    this.mousePosition = null
    this.checkCombinations()

    if (this.keyTimeouts['MouseDown']) {
      clearTimeout(this.keyTimeouts['MouseDown'])
      delete this.keyTimeouts['MouseDown']
    }
    this.keyTimeouts['MouseDown'] = window.setTimeout(() => {
      this.activeKeys.delete('MouseDown')
      delete this.keyTimeouts['MouseDown']
      this.checkCombinations()
    }, this.resetDelay)
  }

  private checkCombinations() {
    for (const [command, combo] of Object.entries(this.combinations)) {
      const keysMatch =
        combo.keys.length === 0 ||
        (this.activeKeys.size === combo.keys.length &&
          combo.keys.every((key) => this.activeKeys.has(key)))

      const modifiersMatch =
        combo.modifiers.length === 0 ||
        (this.activeModifiers.size === combo.modifiers.length &&
          combo.modifiers.every((modifier) =>
            this.activeModifiers.has(modifier)
          ))

      const mouseMatch = combo.mouse
        ? combo.mouse.some((m) => m === this.activeMouse)
        : true

      if (keysMatch && modifiersMatch && mouseMatch) {
        this.triggerCommand(command, {
          mousePos: getPosition(this.mousePosition as MousePosition),
          dragStart: getPosition(this.dragStartPosition as MousePosition),
          modifiers: { ...this.modifiers }
        })
      }
    }
  }

  private triggerCommand(command: string, context: EmitContext) {
    this.emit(command, context)
  }
}

export default InputSystem
