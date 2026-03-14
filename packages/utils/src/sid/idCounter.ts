import { IDTypes } from './enum'
import { DEFAULT_TYPE, FIRST_ID, CODE_SPLIT } from './constants'
import { isNumber } from '../helpers'

class IDCounter {
  counter: Record<string, string> = {}

  constructor() {
    this.init()
  }

  init() {
    Object.values(IDTypes).forEach((type: string) => {
      this.counter[type] =
        type === IDTypes.DEFAULT ? FIRST_ID : `${type}${CODE_SPLIT}${FIRST_ID}`
    })
  }

  current(type: string = IDTypes.DEFAULT): string {
    if (!type) {
      return ''
    }

    return this.counter[type]
  }

  load(id: string, type: string) {
    // Initialize if not exists
    if (!this.counter[type]) {
      this.counter[type] =
        type === DEFAULT_TYPE ? FIRST_ID : `${type}${CODE_SPLIT}${FIRST_ID}`
    }

    const currentId = this.current(type)
    if (!currentId) {
      return ''
    }

    const currentSplits = currentId.split(CODE_SPLIT)
    const currentCount = parseInt(currentSplits[currentSplits.length - 1])

    const newSplits = id.split(CODE_SPLIT)
    const newCount = parseInt(newSplits[newSplits.length - 1])

    if (newCount > currentCount) {
      this.update(type, id)
    }
  }

  update(type: string = IDTypes.DEFAULT, newId: string): void {
    if (!type) {
      return
    }

    this.counter[type] = newId
  }

  increase(type: string = IDTypes.DEFAULT): string {
    if (!type) {
      return ''
    }

    // Initialize if not exists
    if (!this.counter[type]) {
      this.counter[type] =
        type === DEFAULT_TYPE ? FIRST_ID : `${type}${CODE_SPLIT}${FIRST_ID}`
    }

    const currentId = this.counter[type]
    if (!currentId) {
      return ''
    }

    const splits = currentId.split(CODE_SPLIT)
    const count = parseInt(splits[splits.length - 1])
    const next = count + 1

    const prefix = splits.slice(0, -1).join(CODE_SPLIT)
    const newId =
      prefix === '' ? next.toString() : `${prefix}${CODE_SPLIT}${next}`
    this.update(type, newId)

    return newId
  }

  valid(id: string, type: string = IDTypes.DEFAULT): boolean {
    if (!id || !type) {
      return false
    }

    if (type === IDTypes.DEFAULT) {
      return isNumber(id)
    }

    const currentId = this.counter[type]
    const expectedPrefix = currentId ? currentId.split(CODE_SPLIT)[0] : type

    const splits = id.split(CODE_SPLIT)
    if (splits.length !== 2) return false
    if (splits[0] === expectedPrefix) {
      return isNumber(splits[1])
    }

    return false
  }

  /**
   * Register a new component type for auto-numbering
   * Allows app-level components to register without modifying framework IDTypes
   *
   * @param type - Component type string (e.g., 'star', 'myCustomWidget')
   * @param idPrefix - ID prefix string (e.g., 'star', 'myCustomWidget')
   * @param initialValue - Optional starting number (default: 1)
   *
   * @example
   * ```typescript
   * import { idCounter } from '@asyra/sid'
   *
   * // Register custom component type
   * idCounter.registerType('star', 'star')
   * idCounter.registerType('polygon', 'polygon')
   * ```
   */
  registerType(
    type: string,
    idPrefix: string,
    initialValue = Number(FIRST_ID),
    options: { override?: boolean } = {}
  ): void {
    if (!type || !idPrefix) {
      return
    }

    if (this.counter[type] && options.override !== true) {
      return
    }

    const prefixId = `${idPrefix}${CODE_SPLIT}${initialValue}`
    this.counter[type] = prefixId
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
    this.init()
  }
}

export const idCounter = new IDCounter()
