import EventEmitter from '@asra/event-emitter'
import { KeyMap } from './keymap'

type EventCombination = {
  keys: string[]
  mouse?: string
}

type CombinationConfig = Record<string, EventCombination>
type MousePosition = { x: number; y: number }

const MODIFIER_KEYS: Set<string> = new Set(['Control', 'Meta', 'Shift', 'Alt'])

type ModifierKeys = {
  Ctrl?: boolean
  Meta?: boolean
  Shift?: boolean
  Alt?: boolean
}

const normalizeKey = (eventKey: string): string => {
  return eventKey.length === 1 ? eventKey.toUpperCase() : eventKey
}

class InputSystem extends EventEmitter {
  private activeKeys: Set<string> = new Set()
  private activeMouse: string | null = null
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
    window.addEventListener('keydown', (e) => this.onKeyDown(e))
    window.addEventListener('keyup', (e) => this.onKeyUp(e))
    window.addEventListener('mousedown', (e) => this.onMouseDown(e))
    window.addEventListener('mousemove', (e) => this.onMouseMove(e))
    window.addEventListener('mouseup', () => this.onMouseUp())
  }

  private onKeyDown(event: KeyboardEvent) {
    const key = normalizeKey(event.key)
    const standardKey = KeyMap[key as keyof typeof KeyMap] || key
    if (MODIFIER_KEYS.has(standardKey)) {
      this.modifiers[standardKey as keyof ModifierKeys] = true
    }
    this.activeKeys.add(standardKey)
    this.checkCombinations()
  }

  private onKeyUp(event: KeyboardEvent) {
    const key = normalizeKey(event.key)
    const standardKey = KeyMap[key as keyof typeof KeyMap] || key
    if (MODIFIER_KEYS.has(standardKey)) {
      this.modifiers[standardKey as keyof ModifierKeys] = false
    }
    this.activeKeys.delete(standardKey)
    this.checkCombinations()
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
          mousePos: { ...this.mousePosition },
          dragStart: { ...this.dragStartPosition },
          modifiers: { ...this.modifiers }
        })
      }
    }
  }

  private triggerCommand(command: string, context: any) {
    this.emit(command, context)
  }
}

export default InputSystem
