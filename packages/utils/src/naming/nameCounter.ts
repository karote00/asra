import { NameTypes } from './enum'
import { FIRST_NAME, CODE_SPLIT } from './constants'
import { capitalizeFirstLetter, isNumber } from '../helpers'

class NameCounter {
  counter: Record<string, string> = {}

  constructor() {
    Object.values(NameTypes).forEach((type) => {
      this.counter[type] =
        `${capitalizeFirstLetter(type)}${CODE_SPLIT}${FIRST_NAME}`
    })
  }

  current(type: string): string {
    return this.counter[type]
  }

  load(name: string, type: string) {
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

    const newName = `${capitalizeFirstLetter(type)}${CODE_SPLIT}${next}`
    this.update(type, newName)

    return newName
  }

  valid(name: string, type: string): boolean {
    if (!name || !type) {
      return false
    }

    const splits = name.split(CODE_SPLIT)
    if (splits.length !== 2) return false
    if (splits[0] === capitalizeFirstLetter(type)) {
      return isNumber(splits[1])
    }

    return false
  }
}

export const nameCounter = new NameCounter()
