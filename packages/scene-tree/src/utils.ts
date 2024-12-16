import { ElementRawData, EntityTypes, ElementInstanceTypes } from '@asra/utils'
import Frame from './frame'
import Group from './group'
import Rectangle from './rectangle'

const defaultClass = class Default {}
const entityClassMap = {
  [EntityTypes.FRAME]: Frame,
  [EntityTypes.GROUP]: Group,
  [EntityTypes.RECTANGLE]: Rectangle,
  [EntityTypes.OVAL]: defaultClass
} as const

export const createElement = (elementData: ElementRawData) => {
  if (
    elementData.type === EntityTypes.WORKSPACE ||
    elementData.type === EntityTypes.ELEMENT ||
    elementData.type === EntityTypes.UNDEFINED
  ) {
    return null
  }

  const EntityClass = entityClassMap[elementData.type]
  if (!EntityClass) {
    throw new Error('Ivalid entity type.')
  }

  const newEntity = new EntityClass() as ElementInstanceTypes
  newEntity.load(elementData)
  return newEntity
}
