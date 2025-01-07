import EventEmitter from '@asra/event-emitter'
import { KeyMap } from './keymap'

interface EventCombination {
  keys: string[]
  mouse?: string
}

type CombinationConfig = Record<string, EventCombination>

interface MousePosition {
  x: number
  y: number
}

const MODIFIER_KEYS: Set<string> = new Set(['Control', 'Meta', 'Shift', 'Alt'])

interface ModifierKeys {
  Ctrl?: boolean
  Meta?: boolean
  Shift?: boolean
  Alt?: boolean
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
  private activeMouse: string | null = null
  private keyTimeoutIds: Map<string, number> = new Map()
  private timeoutDuration: number = 100
  private dragStartPosition: MousePosition | null = null
  private mousePosition: MousePosition | null = null
  private deltaPosition: MousePosition | null = null
  private modifiers: ModifierKeys = {}
  private canDrag: boolean = false
  private combinations: CombinationConfig = {}

  constructor(combinations: CombinationConfig) {
    super()
    this.combinations = combinations
    this.initEventListeners()
  }

  private initEventListeners() {
    document.addEventListener('keydown', (e) => this.onKeyDown(e))
    document.addEventListener('keyup', (e) => this.onKeyUp(e), true)
    document.addEventListener('mousedown', (e) => this.onMouseDown(e))
    document.addEventListener('mousemove', (e) => this.onMouseMove(e))
    document.addEventListener('mouseup', () => this.onMouseUp())
  }

  private onKeyDown(event: KeyboardEvent) {
    const key = normalizeKey(event.key)
    const standardKey = KeyMap[key as keyof typeof KeyMap] || key

    this.activeKeys.add(standardKey)
    this.updateModifiers(key, true)

    this.checkCombinations()
    if (MODIFIER_KEYS.has(standardKey)) {
      return
    }
    if (this.keyTimeoutIds.has(key)) {
      const timerId = this.keyTimeoutIds.get(key)
      if (timerId) {
        clearTimeout(timerId)
      }
    }

    const timeoutId = window.setTimeout(() => {
      this.handleKeyTimeout(key)
    }, this.timeoutDuration)
    this.keyTimeoutIds.set(key, timeoutId)
  }

  private onKeyUp(event: KeyboardEvent) {
    const key = normalizeKey(event.key)
    const standardKey = KeyMap[key as keyof typeof KeyMap] || key

    if (this.keyTimeoutIds.has(key)) {
      const timerId = this.keyTimeoutIds.get(key)
      if (timerId) {
        clearTimeout(timerId)
      }
      this.keyTimeoutIds.delete(key)
    }

    this.activeKeys.delete(standardKey)
    this.updateModifiers(key, false)
    this.checkCombinations()
  }

  private handleKeyTimeout(key: string) {
    if (this.activeKeys.has(key)) {
      this.activeKeys.delete(key)
      this.keyTimeoutIds.delete(key)
      this.updateModifiers(key, false)
      this.checkCombinations()
    }
  }

  private updateModifiers(key: string, isDown: boolean) {
    if (['ControlLeft', 'ControlRight'].includes(key)) {
      this.modifiers.Ctrl = isDown
    } else if (['MetaLeft', 'MetaRight'].includes(key)) {
      this.modifiers.Meta = isDown
    } else if (['ShiftLeft', 'ShiftRight'].includes(key)) {
      this.modifiers.Shift = isDown
    } else if (['AltLeft', 'AltRight'].includes(key)) {
      this.modifiers.Alt = isDown
    }
  }

  private updateMousePosition(event: MouseEvent) {
    this.mousePosition = { x: event.clientX, y: event.clientY }
  }

  private onMouseDown(event: MouseEvent) {
    this.activeMouse =
      event.button === 0
        ? KeyMap.MouseLeft
        : event.button === 2
          ? KeyMap.MouseRight
          : KeyMap.MouseMiddle
    this.activeKeys.add(KeyMap.MouseDown)
    this.canDrag = true
    this.dragStartPosition = { x: event.clientX, y: event.clientY }
    this.updateMousePosition(event)
    this.checkCombinations()
  }

  private onMouseMove(event: MouseEvent) {
    this.updateMousePosition(event)
    if (
      this.activeKeys.has(KeyMap.MouseDown) &&
      this.activeMouse === KeyMap.MouseLeft &&
      this.dragStartPosition
    ) {
      const dx = event.clientX - this.dragStartPosition.x
      const dy = event.clientY - this.dragStartPosition.y
      this.deltaPosition = { x: dx, y: dy }
      this.checkCombinations()
    }
  }

  private onMouseUp() {
    this.activeKeys.delete(KeyMap.MouseDown)
    this.activeKeys.delete(KeyMap.MouseMove)
    this.activeMouse = null
    this.canDrag = false
    this.dragStartPosition = null
    this.mousePosition = null
    this.checkCombinations()
  }

  private checkCombinations() {
    for (const [command, combo] of Object.entries(this.combinations)) {
      const keysMatch = combo.keys.every((key) => this.activeKeys.has(key))
      const mouseMatch = combo.mouse ? combo.mouse === this.activeMouse : true
      if (keysMatch && mouseMatch) {
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
