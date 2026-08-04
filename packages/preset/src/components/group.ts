import {
  runTransaction,
  type ComponentDefinition,
  type ElementPropertyValuesUpdate,
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
      alias: ['x', 'y', 'rotation']
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

export interface GroupHierarchyReadCore {
  sceneTreeSaveData: () => SceneTreeRawData
}

export interface GroupGeometryProjectionCore extends GroupHierarchyReadCore {
  getElementComputedData: (
    elementId: string
  ) => Record<string, unknown> | undefined
}

export interface GroupOperationCore extends GroupGeometryProjectionCore {
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
  updateElementProperties: (
    updates: readonly ElementPropertyValuesUpdate[],
    options?: EVENT_OPTIONS
  ) => readonly string[]
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

interface GroupGeometryProjection {
  readonly core: GroupGeometryProjectionCore
  readonly projectedValues: Map<string, Record<string, unknown>>
  readonly updatesByElementId: Map<string, Record<string, unknown>>
  readonly orderedElementIds: string[]
}

const createGroupGeometryProjection = (
  core: GroupGeometryProjectionCore
): GroupGeometryProjection => ({
  core,
  projectedValues: new Map(),
  updatesByElementId: new Map(),
  orderedElementIds: []
})

const failGroupPreparation = (message: string): never => {
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
    return failGroupPreparation(
      `parent "${parentId}" is not a canonical container`
    )
  }
  return parent.children
}

const normalizeGroupBoundsInTransaction = (
  projection: GroupGeometryProjection,
  data: SceneTreeRawData,
  groupId: string
): NormalizedGroupBounds => {
  const group = data.elements[groupId] as GroupRawData | undefined
  if (
    !group ||
    group.type !== EntityTypes.GROUP ||
    !Array.isArray(group.children)
  ) {
    return failGroupPreparation(`"${groupId}" is not an official Group`)
  }

  const groupRectangle = readRectangle(projection, groupId)
  const childRectangles = group.children.map((elementId) =>
    readRectangle(projection, elementId)
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

  stageGeometryValues(projection, groupId, nextBounds)
  if (childRectangles.length > 0) {
    childRectangles.forEach(({ id: elementId, x, y }) => {
      stageGeometryValues(projection, elementId, {
        x: x - childBounds.x,
        y: y - childBounds.y
      })
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
  projection: GroupGeometryProjection,
  elementId: string
): Record<string, unknown> => {
  const projectedValues = projection.projectedValues.get(elementId)
  if (projectedValues) {
    return projectedValues
  }

  const data = projection.core.getElementComputedData(elementId)
  if (!data) {
    return failGroupGeometry(`element "${elementId}" has no computed data`)
  }
  const values = { ...data }
  projection.projectedValues.set(elementId, values)
  return values
}

const stageGeometryValues = (
  projection: GroupGeometryProjection,
  elementId: string,
  values: Readonly<Record<string, number>>
): void => {
  const projectedValues = getComputedData(projection, elementId)
  projection.projectedValues.set(elementId, {
    ...projectedValues,
    ...values
  })

  const existingUpdate = projection.updatesByElementId.get(elementId)
  if (!existingUpdate) {
    projection.orderedElementIds.push(elementId)
  }
  projection.updatesByElementId.set(elementId, {
    ...existingUpdate,
    ...values
  })
}

const getProjectedPropertyUpdates = (
  projection: GroupGeometryProjection
): readonly ElementPropertyValuesUpdate[] =>
  Object.freeze(
    projection.orderedElementIds.map((elementId) =>
      Object.freeze({
        elementId,
        values: Object.freeze({
          ...projection.updatesByElementId.get(elementId)
        })
      })
    )
  )

const applyGeometryProjection = (
  core: Pick<GroupOperationCore, 'updateElementProperties'>,
  projection: GroupGeometryProjection,
  options?: EVENT_OPTIONS
): void => {
  if (projection.orderedElementIds.length === 0) {
    return
  }

  core.updateElementProperties(getProjectedPropertyUpdates(projection), options)
}

const readRectangle = (
  projection: GroupGeometryProjection,
  elementId: string
): ElementRectangle => {
  const data = getComputedData(projection, elementId)
  return Object.freeze({
    id: elementId,
    x: readFiniteNumber(data, 'x', elementId),
    y: readFiniteNumber(data, 'y', elementId),
    width: readFiniteNumber(data, 'width', elementId),
    height: readFiniteNumber(data, 'height', elementId)
  })
}

const readPosition = (
  projection: GroupGeometryProjection,
  elementId: string
): Readonly<{ x: number; y: number }> => {
  const data = getComputedData(projection, elementId)
  return Object.freeze({
    x: readFiniteNumber(data, 'x', elementId),
    y: readFiniteNumber(data, 'y', elementId)
  })
}

const getElementWorldPosition = (
  projection: GroupGeometryProjection,
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
    const position = readPosition(projection, currentId)
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

const getAffectedGroupIds = (
  data: SceneTreeRawData,
  elementIds: readonly string[]
): readonly string[] => {
  const groupIds = new Set<string>()

  elementIds.forEach((elementId) => {
    let element = data.elements[elementId]
    if (!element) {
      return failGroupPreparation(`element "${elementId}" is missing`)
    }
    if (element.type === EntityTypes.GROUP) {
      groupIds.add(element.id)
    }

    while (element.parentId) {
      const parent = data.elements[element.parentId]
      if (!parent) {
        return failGroupPreparation(
          `parent "${element.parentId}" of "${element.id}" is missing`
        )
      }
      if (parent.type === EntityTypes.GROUP) {
        groupIds.add(parent.id)
      }
      element = parent
    }
  })

  return [...groupIds].sort(
    (first, second) =>
      getHierarchyDepth(data, second) - getHierarchyDepth(data, first)
  )
}

const GROUP_GEOMETRY_PROPERTY_KEYS = new Set(['x', 'y', 'width', 'height'])

const stageInitialPropertyUpdates = (
  projection: GroupGeometryProjection,
  updates: readonly ElementPropertyValuesUpdate[]
): readonly string[] => {
  const requestedElementIds = new Set<string>()
  const geometryElementIds: string[] = []

  updates.forEach((update) => {
    if (
      !update ||
      typeof update !== 'object' ||
      typeof update.elementId !== 'string' ||
      update.elementId.length === 0 ||
      requestedElementIds.has(update.elementId) ||
      !update.values ||
      typeof update.values !== 'object' ||
      Array.isArray(update.values)
    ) {
      return failGroupPreparation(
        'property updates require unique element ids and value records'
      )
    }

    requestedElementIds.add(update.elementId)
    projection.orderedElementIds.push(update.elementId)
    projection.updatesByElementId.set(update.elementId, {
      ...update.values
    })

    const stagedGeometryValues = Object.fromEntries(
      Object.entries(update.values).filter(([key]) =>
        GROUP_GEOMETRY_PROPERTY_KEYS.has(key)
      )
    )
    if (Object.keys(stagedGeometryValues).length === 0) {
      return
    }

    geometryElementIds.push(update.elementId)
  })

  return Object.freeze(geometryElementIds)
}

export const projectGroupGeometryPropertyUpdates = (
  core: GroupGeometryProjectionCore,
  initialUpdates: readonly ElementPropertyValuesUpdate[],
  explicitGroupElementIds: readonly string[] = []
): readonly ElementPropertyValuesUpdate[] => {
  if (!Array.isArray(initialUpdates)) {
    return failGroupPreparation('property updates must be an array')
  }
  if (initialUpdates.length === 0) {
    return Object.freeze([])
  }

  const projection = createGroupGeometryProjection(core)
  const geometryElementIds = stageInitialPropertyUpdates(
    projection,
    initialUpdates
  )
  if (geometryElementIds.length === 0 || explicitGroupElementIds.length === 0) {
    return getProjectedPropertyUpdates(projection)
  }

  const geometryElementIdSet = new Set(geometryElementIds)
  const groupGeometryElementIds = [...new Set(explicitGroupElementIds)]
  if (
    groupGeometryElementIds.length !== explicitGroupElementIds.length ||
    groupGeometryElementIds.some(
      (elementId) => !geometryElementIdSet.has(elementId)
    )
  ) {
    return failGroupPreparation(
      'explicit Group ids must be unique geometry update targets'
    )
  }

  const data = core.sceneTreeSaveData()
  groupGeometryElementIds.forEach((elementId) => {
    if (data.elements[elementId]?.type !== EntityTypes.GROUP) {
      return failGroupPreparation(
        `explicit geometry target "${elementId}" is not an official Group`
      )
    }
  })

  geometryElementIds.forEach((elementId) => {
    const currentValues = getComputedData(projection, elementId)
    const stagedValues = projection.updatesByElementId.get(elementId) ?? {}
    const stagedGeometryValues = Object.fromEntries(
      Object.entries(stagedValues).filter(([key]) =>
        GROUP_GEOMETRY_PROPERTY_KEYS.has(key)
      )
    )
    projection.projectedValues.set(elementId, {
      ...currentValues,
      ...stagedGeometryValues
    })
  })

  getAffectedGroupIds(data, groupGeometryElementIds).forEach((groupId) => {
    normalizeGroupBoundsInTransaction(projection, data, groupId)
  })
  return getProjectedPropertyUpdates(projection)
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
  core: GroupHierarchyReadCore,
  elementIds: readonly string[]
): PreparedGroupOperation => {
  if (
    !Array.isArray(elementIds) ||
    elementIds.length === 0 ||
    elementIds.some(
      (elementId) => typeof elementId !== 'string' || elementId.length === 0
    )
  ) {
    return failGroupPreparation('element ids must be a non-empty string list')
  }
  if (new Set(elementIds).size !== elementIds.length) {
    return failGroupPreparation('element ids must be unique')
  }

  const data = core.sceneTreeSaveData()
  const elements = elementIds.map((elementId) => {
    const element = data.elements[elementId]
    if (!element) {
      return failGroupPreparation(`element "${elementId}" is missing`)
    }
    return element
  })
  const parentId = elements[0].parentId ?? ''
  if (
    parentId.length === 0 ||
    elements.some((element) => element.parentId !== parentId)
  ) {
    return failGroupPreparation(
      'element ids must resolve to one canonical parent'
    )
  }

  const selectedIds = new Set(elementIds)
  const children = getContainerChildren(data, parentId)
  const canonicalIds = children.filter((childId) => selectedIds.has(childId))
  if (canonicalIds.length !== elementIds.length) {
    return failGroupPreparation(
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
  core: GroupHierarchyReadCore,
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
    return failGroupPreparation(
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
  const preparedGroup = prepareGroupOperation(core, elementIds)
  const geometryProjection = createGroupGeometryProjection(core)
  const rectangles = preparedGroup.elementIds.map((elementId) =>
    readRectangle(geometryProjection, elementId)
  )
  const bounds = deriveGroupBounds(rectangles)

  const groupId = runTransaction(() => {
    const createdGroupId = core.createElementInParent(
      {
        type: EntityTypes.GROUP,
        ...bounds
      },
      preparedGroup.parentId,
      preparedGroup.groupIndex,
      options
    )
    if (!createdGroupId) {
      throw new Error('[Preset] Official Group creation failed')
    }

    core.moveElements(
      {
        elementIds: [...preparedGroup.elementIds],
        targetParentId: createdGroupId,
        targetIndex: 0
      },
      options
    )
    rectangles.forEach(({ id: elementId, x, y }) => {
      stageGeometryValues(geometryProjection, elementId, {
        x: x - bounds.x,
        y: y - bounds.y
      })
    })
    applyGeometryProjection(core, geometryProjection, options)

    return createdGroupId
  })

  return Object.freeze({
    groupId,
    elementIds: Object.freeze([...preparedGroup.elementIds]),
    bounds
  })
}

export const ungroupElement = (
  core: GroupOperationCore,
  groupId: string,
  options?: EVENT_OPTIONS
): UngroupOperationResult => {
  const preparedUngroup = prepareUngroupOperation(core, groupId)
  const geometryProjection = createGroupGeometryProjection(core)
  const groupPosition =
    preparedUngroup.elementIds.length > 0
      ? readPosition(geometryProjection, groupId)
      : undefined
  const childPositions = preparedUngroup.elementIds.map((elementId) => ({
    elementId,
    ...readPosition(geometryProjection, elementId)
  }))

  runTransaction(() => {
    if (childPositions.length > 0 && groupPosition) {
      core.moveElements(
        {
          elementIds: [...preparedUngroup.elementIds],
          targetParentId: preparedUngroup.parentId,
          targetIndex: preparedUngroup.groupIndex
        },
        options
      )
      childPositions.forEach(({ elementId, x, y }) => {
        stageGeometryValues(geometryProjection, elementId, {
          x: x + groupPosition.x,
          y: y + groupPosition.y
        })
      })
      applyGeometryProjection(core, geometryProjection, options)
    }

    core.removeSubtree(groupId, options)
  })

  return Object.freeze({
    groupId,
    elementIds: Object.freeze([...preparedUngroup.elementIds]),
    removed: true
  })
}

export const normalizeGroupsForElements = (
  core: GroupOperationCore,
  elementIds: readonly string[],
  options?: EVENT_OPTIONS
): readonly NormalizedGroupBounds[] => {
  const data = core.sceneTreeSaveData()
  const geometryProjection = createGroupGeometryProjection(core)
  const deepestFirstGroupIds = getAffectedGroupIds(data, elementIds)

  return runTransaction(() => {
    const results = deepestFirstGroupIds.map((groupId) =>
      normalizeGroupBoundsInTransaction(geometryProjection, data, groupId)
    )
    applyGeometryProjection(core, geometryProjection, options)
    return Object.freeze(results)
  })
}

export const moveElementsWithGroupGeometry = (
  core: GroupOperationCore,
  request: MoveHierarchyRequest,
  options?: EVENT_OPTIONS
): MoveHierarchyResult => {
  const beforeData = core.sceneTreeSaveData()
  const geometryProjection = createGroupGeometryProjection(core)

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
      ...getElementWorldPosition(geometryProjection, beforeData, elementId)
    }))
    const targetOrigin =
      afterData.elements[targetParentId]?.type === EntityTypes.WORKSPACE
        ? { x: 0, y: 0 }
        : getElementWorldPosition(geometryProjection, afterData, targetParentId)

    worldPositions.forEach(({ elementId, x, y }) => {
      stageGeometryValues(geometryProjection, elementId, {
        x: x - targetOrigin.x,
        y: y - targetOrigin.y
      })
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
      normalizeGroupBoundsInTransaction(geometryProjection, afterData, groupId)
    })
    applyGeometryProjection(core, geometryProjection, options)

    return result
  })
}
