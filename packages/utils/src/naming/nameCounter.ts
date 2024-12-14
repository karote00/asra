import { NAME_TYPES } from './enum'
import { FIRST_NAME, CODE_SPLIT } from './constants'
import { isNumber } from '../common'

const AvaliableNameTypes = new Set<NAME_TYPES | string>(
  Object.values(NAME_TYPES)
)

class NameCounter {
  counter: { [key: string]: string } = {}

  constructor() {
    Object.values(NAME_TYPES).forEach((type) => {
      this.counter[type] = `${type}${CODE_SPLIT}${FIRST_NAME}`
    })
  }

  current(type: NAME_TYPES): string {
    return this.counter[type]
  }

  update(type: NAME_TYPES, newName: string): void {
    this.counter[type] = newName
  }

  increase(type: NAME_TYPES): string {
    const currentName = this.current(type)
    if (!currentName) {
      return ''
    }

    const splits = currentName.split(CODE_SPLIT)
    const count = parseInt(splits[splits.length - 1])
    const next = count + 1

    const newName = `${type}${CODE_SPLIT}${next}`
    this.update(type, newName)

    return newName
  }

  valid(name: string, type: NAME_TYPES): boolean {
    if (!AvaliableNameTypes.has(type)) {
      return false
    }

    const splits = name.split(CODE_SPLIT)
    if (splits.length !== 2) return false
    if (splits[0] === type) {
      return isNumber(splits[1])
    }

    return false
  }
}

export const nameCounter = new NameCounter()
