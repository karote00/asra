import { ElementRawData, EntityTypes, ElementInstanceTypes } from '@asra/utils'
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

  // If only pass type to create a new element, it should create a new instance with empty data, not load data.
  if (
    Object.keys(elementData).length === 1 &&
    typeof elementData.type !== undefined
  ) {
    return new EntityClass()
  } else {
    return new EntityClass(elementData)
  }
}

export const createWorkspace = (workspaceData = initWorkspaceData) => {
  if (workspaceData.type !== EntityTypes.WORKSPACE) {
    return null
  }

  const newWorkspace = new Workspace()
  newWorkspace.load(workspaceData)
  return newWorkspace
}
