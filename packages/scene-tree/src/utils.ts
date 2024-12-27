import { ElementRawData, EntityTypes, ElementInstanceTypes } from '@asra/utils'
import Frame from './frame'
import Group from './group'
import Rectangle from './rectangle'

const entityClassMap = {
  [EntityTypes.UNDEFINED]: undefined,
  [EntityTypes.FRAME]: Frame,
  [EntityTypes.GROUP]: Group,
  [EntityTypes.RECTANGLE]: Rectangle,
  [EntityTypes.OVAL]: Rectangle
} as const

export const createElement = (elementData: Partial<ElementRawData>) => {
  if (
    elementData.type === EntityTypes.WORKSPACE ||
    elementData.type === EntityTypes.ELEMENT ||
    elementData.type === EntityTypes.UNDEFINED
  ) {
    return null
  }

  const elementType = elementData.type ?? EntityTypes.UNDEFINED
  const EntityClass = entityClassMap[elementType]
  if (!EntityClass) {
    throw new Error('Ivalid entity type.')
  }

  const newEntity = new EntityClass() as ElementInstanceTypes
  newEntity.load(elementData)
  return newEntity
}
