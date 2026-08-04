import { EntityType, EntityTypes } from './enum.js'

const GroupTypesSet: Set<string> = new Set([
  EntityTypes.WORKSPACE,
  EntityTypes.FRAME,
  EntityTypes.GROUP
])

export const isElementEntity = (entityType: EntityType): boolean => {
  return entityType in EntityTypes
}

export const isGroupEntity = (entityType: EntityType): boolean => {
  return GroupTypesSet.has(entityType)
}
