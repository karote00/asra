import { NAME_TYPES } from './enum'
import { nameCounter } from './nameCounter'

export const name = (type: NAME_TYPES): string => nameCounter.increase(type)

export const isValidName = (name: string, type: NAME_TYPES): boolean =>
  nameCounter.valid(name, type)
