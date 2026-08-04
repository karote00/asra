import { NameTypes } from './enum.js'
import { FIRST_NAME, CODE_SPLIT } from './constants.js'
import { capitalizeFirstLetter, isNumber } from '../helpers/index.js'

class NameCounter {
  counter: Record<string, string> = {}

  constructor() {
    this.init()
  }

  init() {
    Object.values(NameTypes).forEach((type) => {
      this.counter[type] =
        `${capitalizeFirstLetter(type)}${CODE_SPLIT}${FIRST_NAME}`
    })
  }

  current(type: string): string {
    return this.counter[type]
  }

  load(name: string, type: string) {
    // Initialize if not exists
    if (!this.counter[type]) {
      this.counter[type] =
        `${capitalizeFirstLetter(type)}${CODE_SPLIT}${FIRST_NAME}`
    }

    const currentName = this.current(type)
    if (!currentName) {
      return ''
    }

    const currentSplits = currentName.split(CODE_SPLIT)
    const currentCount = parseInt(currentSplits[currentSplits.length - 1])

    const newSplits = name.split(CODE_SPLIT)
    const newCount = parseInt(newSplits[newSplits.length - 1])

    if (newCount > currentCount) {
      this.update(type, name)
    }
  }

  update(type: string, newName: string): void {
    this.counter[type] = newName
  }

  increase(type: string): string {
    // Initialize if not exists
    if (!this.counter[type]) {
      this.counter[type] =
        `${capitalizeFirstLetter(type)}${CODE_SPLIT}${FIRST_NAME}`
    }

    const currentName = this.counter[type]
    if (!currentName) {
      return ''
    }

    const splits = currentName.split(CODE_SPLIT)
    const count = parseInt(splits[splits.length - 1])
    const next = count + 1

    const prefix = splits.slice(0, -1).join(CODE_SPLIT)
    const newName = `${prefix}${CODE_SPLIT}${next}`
    this.update(type, newName)

    return newName
  }

  valid(name: string, type: string): boolean {
    if (!name || !type) {
      return false
    }

    const currentName = this.counter[type]
    const expectedPrefix = currentName
      ? currentName.split(CODE_SPLIT).slice(0, -1).join(CODE_SPLIT)
      : capitalizeFirstLetter(type)

    const splits = name.split(CODE_SPLIT)
    if (splits.length !== 2) return false
    if (splits[0] === expectedPrefix) {
      return isNumber(splits[1])
    }

    return false
  }

  /**
   * Register a new component type for auto-numbering
   * Allows app-level components to register without modifying framework NameTypes
   *
   * @param type - Component type string (e.g., 'star', 'myCustomWidget')
   * @param namePrefix - Display name prefix (e.g., 'Star', 'My Custom Widget')
   * @param initialValue - Optional starting number (default: 1)
   *
   * @example
   * ```typescript
   * import { nameCounter } from '@asyra/naming'
   *
   * // Register custom component type
   * nameCounter.registerType('star', 'Star')
   * nameCounter.registerType('polygon', 'Polygon')
   * ```
   */
  registerType(
    type: string,
    namePrefix: string,
    initialValue = Number(FIRST_NAME),
    options: { override?: boolean } = {}
  ): void {
    if (!type || !namePrefix) {
      return
    }

    if (this.counter[type] && options.override !== true) {
      return
    }

    const baseName = namePrefix.replace(/\s+/g, '')
    const typeName = `${baseName}${CODE_SPLIT}${initialValue}`

    this.counter[type] = typeName
  }

  hasType(type: string): boolean {
    if (!type) {
      return false
    }

    return Object.prototype.hasOwnProperty.call(this.counter, type)
  }

  unregisterType(type: string): boolean {
    if (!this.hasType(type)) {
      return false
    }

    const { [type]: _removed, ...nextCounter } = this.counter
    this.counter = nextCounter
    return true
  }

  clear() {
    this.counter = {}
    this.init()
  }
}

export const nameCounter = new NameCounter()
