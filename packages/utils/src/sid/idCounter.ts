import type { IDType } from './enum'
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

    const newId =
      type === DEFAULT_TYPE ? next.toString() : `${type}${CODE_SPLIT}${next}`
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

    const splits = id.split(CODE_SPLIT)
    if (splits.length !== 2) return false
    if (splits[0] === type) {
      return isNumber(splits[1])
    }

    return false
  }

  clear() {
    this.init()
  }
}

export const idCounter = new IDCounter()
