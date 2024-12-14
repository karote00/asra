import { ID_TYPES } from './enum'
import { DEFAULT_TYPE, FIRST_ID, CODE_SPLIT } from './constants'
import { isNumber } from '../common'

const AvaliableIDTypes = new Set<ID_TYPES | string>(Object.values(ID_TYPES))

class IDCounter {
  counter: { [key: string]: string } = {}

  constructor() {
    Object.values(ID_TYPES).forEach((type: string) => {
      this.counter[type] =
        type === ID_TYPES.DEFAULT ? FIRST_ID : `${type}${CODE_SPLIT}${FIRST_ID}`
    })
  }

  current(type: ID_TYPES | string = ID_TYPES.DEFAULT): string {
    if (!type) {
      return ''
    }

    return this.counter[type]
  }

  update(type: ID_TYPES | string = ID_TYPES.DEFAULT, newId: string): void {
    if (!type) {
      return
    }

    this.counter[type] = newId
  }

  increase(type: ID_TYPES | string = ID_TYPES.DEFAULT): string {
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

  valid(id: string, type: ID_TYPES | string = ID_TYPES.DEFAULT): boolean {
    if (!type) {
      return false
    }

    if (!AvaliableIDTypes.has(type)) {
      return false
    }

    if (type === ID_TYPES.DEFAULT) {
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
