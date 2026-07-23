import type { ComponentDefinition, RenderStrategy } from '@asyra/core'
import {
  EntityTypes,
  PropertyTypes,
  createDefaultFills,
  type GroupRawData,
  type SceneTreeRawData
} from '@asyra/utils'
import { DEFAULT_GROUP_STROKES } from './stroke-defaults'
import { PRESET_REGISTRATION } from '../registration'

export const GROUP_COMPONENT_DEFINITION: ComponentDefinition = {
  type: EntityTypes.GROUP,
  idPrefix: 'grp',
  namePrefix: 'Group',
  registration: PRESET_REGISTRATION,
  isContainer: true,
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    },
    {
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    },
    {
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: createDefaultFills({ color: '#cccccc', visible: false })
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: DEFAULT_GROUP_STROKES
    }
  ]
}

export const GROUP_RENDER_STRATEGY: RenderStrategy = (graphic, data) => {
  graphic.clear()
  // No visual rendering for group itself besides updating position
  graphic.x = data.x
  graphic.y = data.y
}

export interface GroupOperationCore {
  sceneTreeSaveData: () => SceneTreeRawData
}

export interface PreparedGroupOperation {
  readonly kind: 'group'
  readonly parentId: string
  readonly groupIndex: number
  readonly elementIds: readonly string[]
}

export interface PreparedUngroupOperation {
  readonly kind: 'ungroup'
  readonly groupId: string
  readonly parentId: string
  readonly groupIndex: number
  readonly elementIds: readonly string[]
}

const failGroupPlan = (message: string): never => {
  throw new Error(
    `[Preset] Cannot prepare official Group operation: ${message}`
  )
}

const getContainerChildren = (
  data: SceneTreeRawData,
  parentId: string
): readonly string[] => {
  const parent = data.elements[parentId] as GroupRawData | undefined
  if (!parent || !Array.isArray(parent.children)) {
    return failGroupPlan(`parent "${parentId}" is not a canonical container`)
  }
  return parent.children
}

export const prepareGroupOperation = (
  core: GroupOperationCore,
  elementIds: readonly string[]
): PreparedGroupOperation => {
  if (
    !Array.isArray(elementIds) ||
    elementIds.length === 0 ||
    elementIds.some(
      (elementId) => typeof elementId !== 'string' || elementId.length === 0
    )
  ) {
    return failGroupPlan('element ids must be a non-empty string list')
  }
  if (new Set(elementIds).size !== elementIds.length) {
    return failGroupPlan('element ids must be unique')
  }

  const data = core.sceneTreeSaveData()
  const elements = elementIds.map((elementId) => {
    const element = data.elements[elementId]
    if (!element) {
      return failGroupPlan(`element "${elementId}" is missing`)
    }
    return element
  })
  const parentId = elements[0].parentId ?? ''
  if (
    parentId.length === 0 ||
    elements.some((element) => element.parentId !== parentId)
  ) {
    return failGroupPlan('element ids must resolve to one canonical parent')
  }

  const selectedIds = new Set(elementIds)
  const children = getContainerChildren(data, parentId)
  const canonicalIds = children.filter((childId) => selectedIds.has(childId))
  if (canonicalIds.length !== elementIds.length) {
    return failGroupPlan(
      'element ids must each have one canonical parent membership'
    )
  }

  return Object.freeze({
    kind: 'group',
    parentId,
    groupIndex: children.indexOf(canonicalIds[0]),
    elementIds: Object.freeze([...canonicalIds])
  })
}

export const prepareUngroupOperation = (
  core: GroupOperationCore,
  groupId: string
): PreparedUngroupOperation => {
  const data = core.sceneTreeSaveData()
  const group = data.elements[groupId] as GroupRawData | undefined
  if (
    !group ||
    group.type !== EntityTypes.GROUP ||
    !Array.isArray(group.children)
  ) {
    throw new Error(
      `[Preset] Cannot prepare ungroup: "${groupId}" is not an official Group`
    )
  }

  const parentId = group.parentId ?? ''
  const siblings = getContainerChildren(data, parentId)
  const groupIndex = siblings.indexOf(groupId)
  if (groupIndex < 0 || siblings.lastIndexOf(groupId) !== groupIndex) {
    return failGroupPlan(
      `Group "${groupId}" must have one canonical parent membership`
    )
  }

  return Object.freeze({
    kind: 'ungroup',
    groupId,
    parentId,
    groupIndex,
    elementIds: Object.freeze([...group.children])
  })
}
