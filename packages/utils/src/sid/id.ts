import { IDTypes } from './enum'
import { idCounter } from './idCounter'

export const id = (type: IDTypes): string => idCounter.increase(type)

export const isValidId = (id: string, type: IDTypes): boolean =>
  idCounter.valid(id, type)
