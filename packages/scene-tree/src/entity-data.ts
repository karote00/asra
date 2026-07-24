import {
  ComputedAttrs,
  ElementInstanceTypes,
  ElementRawData,
  EntityTypes
} from '@asyra/utils'
import Workspace from './components/workspace'
import componentRegistry from './component-registry'
import type { ISceneTreeRegistry } from './types'
import propsManager, { type PropsManager } from '@asyra/props-manager'
import { runWithSceneTreePropsManager } from './props-manager-context'

const initWorkspaceData = {
  type: EntityTypes.WORKSPACE
}

export const isGroupEntity = (type: string): boolean => {
  if (
    type === EntityTypes.WORKSPACE ||
    type === EntityTypes.FRAME ||
    type === EntityTypes.GROUP
  ) {
    return true
  }

  const registration = componentRegistry.get(type)
  return registration?.isContainer ?? false
}

export const createElement = (
  elementData: Partial<ElementRawData>,
  propsManagerOwner: PropsManager = propsManager
): ElementInstanceTypes | null => {
  if (
    elementData.type === EntityTypes.WORKSPACE ||
    elementData.type === EntityTypes.ELEMENT ||
    elementData.type === EntityTypes.UNDEFINED
  ) {
    return null
  }

  const elementType = elementData.type ?? EntityTypes.UNDEFINED

  // Check registry first for custom components
  const registration = componentRegistry.get(elementType)
  if (registration) {
    const EntityClass = registration.constructor
    const constructorData = { ...elementData }
    delete constructorData.type

    return runWithSceneTreePropsManager(
      propsManagerOwner,
      () => new EntityClass(constructorData)
    )
  }

  throw new Error(`No component registered for type: ${elementType}`)
}

export const createWorkspace = (
  registry: ISceneTreeRegistry,
  workspaceData: Partial<ElementRawData> = initWorkspaceData
): Workspace | null => {
  if (workspaceData.type !== EntityTypes.WORKSPACE) {
    return null
  }

  const newWorkspace = new Workspace(registry)
  newWorkspace.load(workspaceData)
  return newWorkspace
}

const DefaultRawKeys: (keyof ElementRawData)[] = [
  'id',
  'type',
  'name',
  'parentId',
  'visible',
  'lock',
  'props'
]

/**
 * Removes non-raw fields from an element object and returns the stripped fields.
 *
 * @param elementData - The original element object which may contain extra fields.
 * @param rawKeys - Keys that should be kept in the original object (defaults to ElementRawData keys).
 * @returns An object containing the stripped (non-raw) fields.
 */
export const stripNonRawFields = (
  elementData: Record<string, unknown>,
  rawKeys: (keyof ElementRawData)[] = DefaultRawKeys
): Record<string, ComputedAttrs[keyof ComputedAttrs]> => {
  const stripped = {} as Record<string, ComputedAttrs[keyof ComputedAttrs]>

  for (const key in elementData) {
    if (!rawKeys.includes(key as keyof ElementRawData)) {
      stripped[key] = elementData[key] as ComputedAttrs[keyof ComputedAttrs]
    }
  }

  // Remove all non-raw keys from the original object
  Object.keys(stripped).forEach((key) => {
    /* eslint-disable-next-line @typescript-eslint/no-dynamic-delete */
    delete elementData[key]
  })

  return stripped
}
