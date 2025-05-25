import { IDTypes } from './enum'
import { DEFAULT_TYPE, FIRST_ID, CODE_SPLIT } from './constants'
import { isNumber } from '../helpers'

const AvaliableIDTypes = new Set<IDTypes | string>(Object.values(IDTypes))

class IDCounter {
  counter: Record<string, string> = {}

  constructor() {
    Object.values(IDTypes).forEach((type: string) => {
      this.counter[type] =
        type === IDTypes.DEFAULT ? FIRST_ID : `${type}${CODE_SPLIT}${FIRST_ID}`
    })
  }

  current(type: IDTypes | string = IDTypes.DEFAULT): string {
    if (!type) {
      return ''
    }

    return this.counter[type]
  }

  load(id: string, type: IDTypes) {
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

  update(type: IDTypes | string = IDTypes.DEFAULT, newId: string): void {
    if (!type) {
      return
    }

    this.counter[type] = newId
  }

  increase(type: IDTypes | string = IDTypes.DEFAULT): string {
    if (!type) {
      return ''
    }

    const currentId = this.current(type)
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

  valid(id: string, type: IDTypes | string = IDTypes.DEFAULT): boolean {
    if (!id || !type || !AvaliableIDTypes.has(type)) {
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
}

export const idCounter = new IDCounter()
