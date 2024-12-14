import { ID_TYPES } from './enum'
import { idCounter } from './idCounter'

export const id = (type: ID_TYPES): string => idCounter.increase(type)

export const isValidId = (id: string, type: ID_TYPES): boolean =>
  idCounter.valid(id, type)
