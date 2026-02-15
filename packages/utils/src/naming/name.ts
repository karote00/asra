import { nameCounter } from './nameCounter'

export const name = (type: string): string => nameCounter.increase(type)

export const loadName = (name: string, type: string) => {
  if (!isValidName(name, type)) {
    return
  }

  nameCounter.load(name, type)
}

export const isValidName = (name: string, type: string): boolean =>
  nameCounter.valid(name, type)
