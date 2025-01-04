type EventType = 'keydown' | 'keyup' | 'mousedown' | 'mouseup' | 'mousemove'

type EventCombination = {
  keys: string[]
  mouse?: string
  eventType?: EventType
}

type CombinationConfig = Record<string, EventCombination>

class EventManager {
  private activeKeys: Set<string> = new Set()
  private mouseEvent: string | null = null
  private combinations: CombinationConfig = {}
  private canDrag: boolean = false
  private dragStartPosition: { x: number; y: number } | null = null

  constructor(combinations: CombinationConfig) {
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
    this.activeKeys.add(event.key)
    this.checkCombinations('keydown')
  }

  private onKeyUp(event: KeyboardEvent) {
    this.activeKeys.delete(event.key)
    this.checkCombinations('keyup')
  }

  private onMouseDown(event: MouseEvent) {
    this.mouseEvent =
      event.button === 0 ? 'left' : event.button === 2 ? 'right' : 'middle'
    this.canDrag = true
    this.dragStartPosition = { x: event.clientX, y: event.clientY }
    this.checkCombinations('mousedown')
  }

  private onMouseMove(event: MouseEvent) {
    if (this.canDrag && this.dragStartPosition) {
      const dx = event.clientX - this.dragStartPosition.x
      const dy = event.clientY - this.dragStartPosition.y
      console.log('Mouse Move:', { dx, dy })

      this.dragStartPosition = { x: event.clientX, y: event.clientY }
      this.checkCombinations('mousemove')
    }
  }

  private onMouseUp() {
    this.mouseEvent = null
    this.canDrag = false
    this.dragStartPosition = null
    this.checkCombinations('mouseup')
  }

  private checkCombinations(eventType: EventType) {
    for (const [command, combo] of Object.entries(this.combinations)) {
      const eventTypeMatch = combo.eventType
        ? combo.eventType === eventType
        : true
      const keysMatch = combo.keys.every((key) => this.activeKeys.has(key))
      const mouseMatch = combo.mouse ? combo.mouse === this.mouseEvent : true
      if (eventTypeMatch && keysMatch && mouseMatch) {
        this.triggerCommand(command)
      }
    }
  }

  private triggerCommand(command: string) {
    console.log(`Command Triggered: ${command}`)
    // TODO: call core api or emit event. better to emit event
  }
}

export default EventManager

// // Load combinations from JSON
// fetch('/path/to/combinations.json')
//   .then((response) => response.json())
//   .then((combinations: CombinationConfig) => {
//     const plugin = new KeyboardMousePlugin(combinations)
//   })
