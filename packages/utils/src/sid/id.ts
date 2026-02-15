import { idCounter } from './idCounter'

export const id = (type: string): string => idCounter.increase(type)

export const loadId = (name: string, type: string) => {
  if (!isValidId(name, type)) {
    return
  }

  idCounter.load(name, type)
}

export const isValidId = (id: string, type: string): boolean =>
  idCounter.valid(id, type)

export const resetIdCounter = () => {
  idCounter.clear()
}
