import {
  runTransaction,
  type ComponentDefinition,
  type RenderStrategy
} from '@asyra/core'
import {
  EntityTypes,
  PropertyTypes,
  createDefaultFills,
  type EVENT_OPTIONS,
  type GroupRawData,
  type MoveHierarchyRequest,
  type MoveHierarchyResult,
  type RemoveSubtreeResult,
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

export interface GroupPlanningCore {
  sceneTreeSaveData: () => SceneTreeRawData
}

export interface GroupOperationCore extends GroupPlanningCore {
  getElementComputedData: (
    elementId: string
  ) => Record<string, unknown> | undefined
  createElementInParent: (
    data: {
      type: string
      x: number
      y: number
      width: number
      height: number
    },
    parentId: string,
    index?: number,
    options?: EVENT_OPTIONS
  ) => string
  moveElements: (
    request: MoveHierarchyRequest,
    options?: EVENT_OPTIONS
  ) => MoveHierarchyResult
  changeComputedData: (
    elementIds: string[],
    data: Record<string, number>,
    options?: EVENT_OPTIONS
  ) => void
  removeSubtree: (
    elementId: string,
    options?: EVENT_OPTIONS
  ) => RemoveSubtreeResult
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

export interface GroupBounds {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface GroupOperationResult {
  readonly groupId: string
  readonly elementIds: readonly string[]
  readonly bounds: GroupBounds
}

export interface UngroupOperationResult {
  readonly groupId: string
  readonly elementIds: readonly string[]
  readonly removed: true
}

export interface NormalizedGroupBounds {
  readonly groupId: string
  readonly bounds: GroupBounds
}

interface ElementRectangle {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
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

const normalizeGroupBoundsInTransaction = (
  core: GroupOperationCore,
  data: SceneTreeRawData,
  groupId: string,
  options?: EVENT_OPTIONS
): NormalizedGroupBounds => {
  const group = data.elements[groupId] as GroupRawData | undefined
  if (
    !group ||
    group.type !== EntityTypes.GROUP ||
    !Array.isArray(group.children)
  ) {
    return failGroupPlan(`"${groupId}" is not an official Group`)
  }

  const groupRectangle = readRectangle(core, groupId)
  const childRectangles = group.children.map((elementId) =>
    readRectangle(core, elementId)
  )
  const childBounds = deriveGroupBounds(childRectangles)
  const nextBounds =
    childRectangles.length === 0
      ? Object.freeze({
          x: groupRectangle.x,
          y: groupRectangle.y,
          width: 0,
          height: 0
        })
      : Object.freeze({
          x: groupRectangle.x + childBounds.x,
          y: groupRectangle.y + childBounds.y,
          width: childBounds.width,
          height: childBounds.height
        })

  core.changeComputedData([groupId], { ...nextBounds }, options)
  if (childRectangles.length > 0) {
    childRectangles.forEach(({ id: elementId, x, y }) => {
      core.changeComputedData(
        [elementId],
        {
          x: x - childBounds.x,
          y: y - childBounds.y
        },
        options
      )
    })
  }

  return Object.freeze({
    groupId,
    bounds: nextBounds
  })
}

const failGroupGeometry = (message: string): never => {
  throw new Error(
    `[Preset] Group operation requires finite 2D geometry: ${message}`
  )
}

const readFiniteNumber = (
  data: Record<string, unknown>,
  key: 'x' | 'y' | 'width' | 'height',
  elementId: string
): number => {
  const value = data[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return failGroupGeometry(`"${elementId}.${key}" is invalid`)
  }
  return value
}

const getComputedData = (
  core: GroupOperationCore,
  elementId: string
): Record<string, unknown> => {
  const data = core.getElementComputedData(elementId)
  if (!data) {
    return failGroupGeometry(`element "${elementId}" has no computed data`)
  }
  return data
}

const readRectangle = (
  core: GroupOperationCore,
  elementId: string
): ElementRectangle => {
  const data = getComputedData(core, elementId)
  return Object.freeze({
    id: elementId,
    x: readFiniteNumber(data, 'x', elementId),
    y: readFiniteNumber(data, 'y', elementId),
    width: readFiniteNumber(data, 'width', elementId),
    height: readFiniteNumber(data, 'height', elementId)
  })
}

const readPosition = (
  core: GroupOperationCore,
  elementId: string
): Readonly<{ x: number; y: number }> => {
  const data = getComputedData(core, elementId)
  return Object.freeze({
    x: readFiniteNumber(data, 'x', elementId),
    y: readFiniteNumber(data, 'y', elementId)
  })
}

const getElementWorldPosition = (
  core: GroupOperationCore,
  data: SceneTreeRawData,
  elementId: string
): Readonly<{ x: number; y: number }> => {
  let currentId = elementId
  let x = 0
  let y = 0
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) {
      return failGroupGeometry(`hierarchy cycle reaches "${currentId}"`)
    }
    visited.add(currentId)
    const element = data.elements[currentId]
    if (!element) {
      return failGroupGeometry(`element "${currentId}" is missing`)
    }
    if (element.type === EntityTypes.WORKSPACE) {
      break
    }
    const position = readPosition(core, currentId)
    x += position.x
    y += position.y
    currentId = element.parentId ?? ''
  }

  return Object.freeze({ x, y })
}

const getHierarchyDepth = (
  data: SceneTreeRawData,
  elementId: string
): number => {
  let depth = 0
  let element = data.elements[elementId]
  while (element?.parentId) {
    depth += 1
    element = data.elements[element.parentId]
  }
  return depth
}

export const deriveGroupBounds = (
  rectangles: readonly Pick<ElementRectangle, 'x' | 'y' | 'width' | 'height'>[]
): GroupBounds => {
  if (rectangles.length === 0) {
    return Object.freeze({ x: 0, y: 0, width: 0, height: 0 })
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  rectangles.forEach(({ x, y, width, height }) => {
    const values = [x, y, width, height]
    if (values.some((value) => !Number.isFinite(value))) {
      return failGroupGeometry('direct-child rectangle is invalid')
    }
    minX = Math.min(minX, x, x + width)
    minY = Math.min(minY, y, y + height)
    maxX = Math.max(maxX, x, x + width)
    maxY = Math.max(maxY, y, y + height)
  })

  return Object.freeze({
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  })
}

export const prepareGroupOperation = (
  core: GroupPlanningCore,
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
  core: GroupPlanningCore,
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

export const groupElements = (
  core: GroupOperationCore,
  elementIds: readonly string[],
  options?: EVENT_OPTIONS
): GroupOperationResult => {
  const plan = prepareGroupOperation(core, elementIds)
  const rectangles = plan.elementIds.map((elementId) =>
    readRectangle(core, elementId)
  )
  const bounds = deriveGroupBounds(rectangles)

  const groupId = runTransaction(() => {
    const createdGroupId = core.createElementInParent(
      {
        type: EntityTypes.GROUP,
        ...bounds
      },
      plan.parentId,
      plan.groupIndex,
      options
    )
    if (!createdGroupId) {
      throw new Error('[Preset] Official Group creation failed')
    }

    core.moveElements(
      {
        elementIds: [...plan.elementIds],
        targetParentId: createdGroupId,
        targetIndex: 0
      },
      options
    )
    rectangles.forEach(({ id: elementId, x, y }) => {
      core.changeComputedData(
        [elementId],
        {
          x: x - bounds.x,
          y: y - bounds.y
        },
        options
      )
    })

    return createdGroupId
  })

  return Object.freeze({
    groupId,
    elementIds: Object.freeze([...plan.elementIds]),
    bounds
  })
}

export const ungroupElement = (
  core: GroupOperationCore,
  groupId: string,
  options?: EVENT_OPTIONS
): UngroupOperationResult => {
  const plan = prepareUngroupOperation(core, groupId)
  const groupPosition =
    plan.elementIds.length > 0 ? readPosition(core, groupId) : undefined
  const childPositions = plan.elementIds.map((elementId) => ({
    elementId,
    ...readPosition(core, elementId)
  }))

  runTransaction(() => {
    if (childPositions.length > 0 && groupPosition) {
      core.moveElements(
        {
          elementIds: [...plan.elementIds],
          targetParentId: plan.parentId,
          targetIndex: plan.groupIndex
        },
        options
      )
      childPositions.forEach(({ elementId, x, y }) => {
        core.changeComputedData(
          [elementId],
          {
            x: x + groupPosition.x,
            y: y + groupPosition.y
          },
          options
        )
      })
    }

    core.removeSubtree(groupId, options)
  })

  return Object.freeze({
    groupId,
    elementIds: Object.freeze([...plan.elementIds]),
    removed: true
  })
}

export const normalizeGroupsForElements = (
  core: GroupOperationCore,
  elementIds: readonly string[],
  options?: EVENT_OPTIONS
): readonly NormalizedGroupBounds[] => {
  const data = core.sceneTreeSaveData()
  const groupIds = new Set<string>()

  elementIds.forEach((elementId) => {
    let element = data.elements[elementId]
    if (!element) {
      return failGroupPlan(`element "${elementId}" is missing`)
    }

    while (element.parentId) {
      const parent = data.elements[element.parentId]
      if (!parent) {
        return failGroupPlan(
          `parent "${element.parentId}" of "${element.id}" is missing`
        )
      }
      if (parent.type === EntityTypes.GROUP) {
        groupIds.add(parent.id)
      }
      element = parent
    }
  })

  const deepestFirstGroupIds = [...groupIds].sort(
    (first, second) =>
      getHierarchyDepth(data, second) - getHierarchyDepth(data, first)
  )

  return runTransaction(() =>
    Object.freeze(
      deepestFirstGroupIds.map((groupId) =>
        normalizeGroupBoundsInTransaction(core, data, groupId, options)
      )
    )
  )
}

export const moveElementsWithGroupGeometry = (
  core: GroupOperationCore,
  request: MoveHierarchyRequest,
  options?: EVENT_OPTIONS
): MoveHierarchyResult => {
  const beforeData = core.sceneTreeSaveData()

  return runTransaction(() => {
    const result = core.moveElements(request, options)
    if (result.moves.length === 0) {
      return result
    }

    const sourceParentId = result.moves[0].before.parentId
    const targetParentId = result.moves[0].after.parentId
    const afterData = core.sceneTreeSaveData()
    const sourceIsGroup =
      beforeData.elements[sourceParentId]?.type === EntityTypes.GROUP
    const targetIsGroup =
      afterData.elements[targetParentId]?.type === EntityTypes.GROUP
    if (!sourceIsGroup && !targetIsGroup) {
      return result
    }

    const worldPositions = result.elementIds.map((elementId) => ({
      elementId,
      ...getElementWorldPosition(core, beforeData, elementId)
    }))
    const targetOrigin =
      afterData.elements[targetParentId]?.type === EntityTypes.WORKSPACE
        ? { x: 0, y: 0 }
        : getElementWorldPosition(core, afterData, targetParentId)

    worldPositions.forEach(({ elementId, x, y }) => {
      core.changeComputedData(
        [elementId],
        {
          x: x - targetOrigin.x,
          y: y - targetOrigin.y
        },
        options
      )
    })

    const groupIds = new Set<string>()
    const affectedParentIds = [sourceParentId, targetParentId]
    affectedParentIds.forEach((parentId) => {
      let element: SceneTreeRawData['elements'][string] | undefined =
        afterData.elements[parentId]
      while (element) {
        if (element.type === EntityTypes.GROUP) {
          groupIds.add(element.id)
        }
        element = element.parentId
          ? afterData.elements[element.parentId]
          : undefined
      }
    })
    const deepestFirstGroupIds = [...groupIds].sort(
      (first, second) =>
        getHierarchyDepth(afterData, second) -
        getHierarchyDepth(afterData, first)
    )
    deepestFirstGroupIds.forEach((groupId) => {
      normalizeGroupBoundsInTransaction(core, afterData, groupId, options)
    })

    return result
  })
}
