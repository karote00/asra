import { EntityTypes } from './enum'

const GroupTypesSet = new Set([
  EntityTypes.WORKSPACE,
  EntityTypes.FRAME,
  EntityTypes.GROUP
])

export const isElementEntity = (entityType: EntityTypes): boolean => {
  return entityType in EntityTypes
}

export const isGroupEntity = (entityType: EntityTypes): boolean => {
  return GroupTypesSet.has(entityType)
}
