import {
  ElementRawData,
  EntityTypes,
  ElementInstanceTypes,
  WorkspaceRawData
} from '@asra/utils'
import Frame from './components/frame'
import Group from './components/group'
import Rectangle from './components/rectangle'
import Workspace from './components/workspace'

const entityClassMap = {
  [EntityTypes.UNDEFINED]: undefined,
  [EntityTypes.FRAME]: Frame,
  [EntityTypes.GROUP]: Group,
  [EntityTypes.RECTANGLE]: Rectangle,
  [EntityTypes.OVAL]: Rectangle
} as const

const initWorkspaceData = {
  type: EntityTypes.WORKSPACE
}

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

export const createWorkspace = (workspaceData = initWorkspaceData) => {
  if (workspaceData.type !== EntityTypes.WORKSPACE) {
    return null
  }

  const newWorkspace = new Workspace()
  newWorkspace.load(workspaceData)
  return newWorkspace
}
