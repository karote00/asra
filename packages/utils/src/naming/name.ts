import { NameTypes } from './enum'
import { nameCounter } from './nameCounter'

export const name = (type: NameTypes): string => nameCounter.increase(type)

export const isValidName = (name: string, type: NameTypes): boolean =>
  nameCounter.valid(name, type)
