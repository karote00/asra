/**
 * Element Utility APIs - common element operations
 * Used in: create-element, and future features
 */

import { runTransaction, type ElementPropertyPatchUpdate } from '@asyra/core'
import {
  moveElementsWithGroupGeometry,
  normalizeGroupsForElements
} from '@asyra/preset'
import {
  DEFAULT_ELEMENT_SIZE,
  EntityTypes,
  createDefaultFills,
  type DataTypes,
  type EntityType,
  type EVENT_OPTIONS,
  type PositionData
} from '@asyra/utils'
import core from '../../contexts'
import {
  DEFAULT_ELEMENT_FILL_COLOR,
  DEFAULT_FRAME_FILL_COLOR
} from '../../constants'
import type {
  CreateElementOptions,
  ElementBounds,
  PreparedElementDescriptor
} from './types'
import { vectorApis } from './vector-apis'
import { updateElementProperties as applyElementPropertyUpdate } from './update-element-properties'
import { viewportApis } from '../viewport'

export type { VectorPointTarget } from './types'
export {
  vectorGeometry,
  type AppendVectorAnchorPointOptions,
  type VectorPointUpdate
} from './vector-apis'

const resolveEventOptions = (options?: EVENT_OPTIONS): EVENT_OPTIONS => {
  if (options) {
    return options
  }

  return { undoable: true }
}

const setElementFlag = (
  elementId: string,
  key: 'lock' | 'visible',
  value: boolean,
  options?: EVENT_OPTIONS
): boolean => {
  const element = core.getElementData(elementId)
  if (!element || element.type === EntityTypes.WORKSPACE) {
    return false
  }

  if (element[key] === value) {
    return false
  }

  const resolvedOptions = resolveEventOptions(options)

  runTransaction(() => {
    core.updateElementData(elementId, { [key]: value }, resolvedOptions)
  })

  return true
}

const getDefaultFillsForType = (type: EntityType) => {
  switch (type) {
    case 'frame':
      return createDefaultFills({ color: DEFAULT_FRAME_FILL_COLOR })
    case 'group':
      return createDefaultFills({
        color: DEFAULT_ELEMENT_FILL_COLOR,
        visible: false
      })
    case 'vector':
      return []
    case 'rect':
    case 'oval':
    default:
      return createDefaultFills({ color: DEFAULT_ELEMENT_FILL_COLOR })
  }
}

const isContainerType = (type: string): boolean => {
  return core.isContainerType(type)
}

const getElementChildren = (element: unknown): string[] => {
  const value = (element as { children?: unknown } | null)?.children
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (childId): childId is string => typeof childId === 'string'
  )
}

const getWorkspaceOrderedElementIds = (): string[] => {
  const workspaceId = core.getCurrentWorkspaceId()
  const workspace = core.getElementData(workspaceId)
  if (!workspace) {
    return []
  }

  const orderedIds: string[] = []
  const visit = (elementId: string) => {
    const element = core.getElementData(elementId)
    if (!element) {
      return
    }

    const elementType = element.type as string
    const isContainer = isContainerType(elementType)

    if (isContainer) {
      const canReadChildren = Object.prototype.hasOwnProperty.call(
        element,
        'children'
      )
      if (canReadChildren) {
        const children = getElementChildren(element)
        if (children.length > 0) {
          children.forEach((childId) => visit(childId))
        }
      }

      orderedIds.push(elementId)
      return
    }

    orderedIds.push(elementId)
  }

  const workspaceChildren = getElementChildren(workspace)
  if (workspaceChildren.length > 0) {
    workspaceChildren.forEach((childId) => visit(childId))
  }

  return orderedIds
}

const boundsIntersect = (a: ElementBounds, b: ElementBounds): boolean => {
  const aMaxX = a.x + a.width
  const aMaxY = a.y + a.height
  const bMaxX = b.x + b.width
  const bMaxY = b.y + b.height

  return a.x <= bMaxX && aMaxX >= b.x && a.y <= bMaxY && aMaxY >= b.y
}

const createElementAtWorkspacePos = (
  type: EntityType,
  workspacePos: PositionData,
  parentId: string,
  extraData: Record<string, DataTypes> = {},
  options?: EVENT_OPTIONS,
  parentWorkspaceOrigin?: PositionData
): string | null => {
  const workspaceId = core.getCurrentWorkspaceId()
  if (!workspaceId) {
    return null
  }

  let targetIndex: number | null = null
  if (parentId !== workspaceId) {
    const parent = core.getElementData(parentId)
    if (parent?.type !== EntityTypes.GROUP) {
      return null
    }
    targetIndex = getElementChildren(parent).length
  }
  const createDirectlyInParent =
    targetIndex !== null &&
    parentWorkspaceOrigin !== undefined &&
    Number.isFinite(parentWorkspaceOrigin.x) &&
    Number.isFinite(parentWorkspaceOrigin.y)
  const initialPosition = createDirectlyInParent
    ? {
        x: workspacePos.x - parentWorkspaceOrigin.x,
        y: workspacePos.y - parentWorkspaceOrigin.y
      }
    : workspacePos

  return runTransaction(() => {
    const elementId = core.createElementInParent(
      {
        type,
        x: initialPosition.x,
        y: initialPosition.y,
        ...extraData
      },
      createDirectlyInParent ? parentId : workspaceId,
      undefined,
      options
    )
    if (!elementId) {
      throw new Error('[element-creation] canonical element creation failed')
    }

    if (targetIndex !== null && !createDirectlyInParent) {
      moveElementsWithGroupGeometry(
        core,
        {
          elementIds: [elementId],
          targetParentId: parentId,
          targetIndex
        },
        options
      )
    }

    return elementId
  })
}

export const elementApis = {
  isContainerType: (type: string): boolean => {
    return isContainerType(type)
  },

  getElementIdAtWorkspacePos: (workspacePos: PositionData): string | null => {
    const orderedIds = getWorkspaceOrderedElementIds()
    for (let i = orderedIds.length - 1; i >= 0; i -= 1) {
      const elementId = orderedIds[i]
      const element = core.getElementData(elementId)
      if (!element) {
        continue
      }

      const type = element.type
      if (type === EntityTypes.WORKSPACE) {
        continue
      }

      if (elementApis.isPointInsideElement(elementId, workspacePos)) {
        return elementId
      }
    }

    return null
  },

  getElementIdsInBounds: (bounds: ElementBounds): string[] => {
    if (!bounds) {
      return []
    }

    const orderedIds = getWorkspaceOrderedElementIds()
    return orderedIds.filter((elementId) => {
      const element = core.getElementData(elementId)
      if (!element) {
        return false
      }

      if (element.type === EntityTypes.WORKSPACE) {
        return false
      }

      const elementBounds = elementApis.getElementBounds(elementId)
      if (!elementBounds) {
        return false
      }

      return boundsIntersect(elementBounds, bounds)
    })
  },

  getElementIdAtClientPos: (clientPos: PositionData): string | null => {
    const renderHit = core.getElementIdAtClientPos(clientPos)
    if (renderHit) {
      return renderHit
    }

    const workspacePos = elementApis.getMousePosInWorkspace(clientPos)
    return workspacePos
      ? elementApis.getElementIdAtWorkspacePos(workspacePos)
      : null
  },

  getRenderElementIdAtClientPos: (clientPos: PositionData): string | null => {
    return core.getElementIdAtClientPos(clientPos)
  },

  getElementType: (elementId: string): string | undefined => {
    return core.getElementData(elementId)?.type
  },

  isElementLocked: (elementId: string): boolean => {
    const lockValue = core.getElementData(elementId)?.lock
    return lockValue === true
  },

  isElementVisible: (elementId: string): boolean => {
    const visibleValue = core.getElementData(elementId)?.visible
    return visibleValue !== false
  },

  setElementLock: (
    elementId: string,
    lock: boolean,
    options?: EVENT_OPTIONS
  ): boolean => {
    return setElementFlag(elementId, 'lock', lock, options)
  },

  setElementVisible: (
    elementId: string,
    visible: boolean,
    options?: EVENT_OPTIONS
  ): boolean => {
    return setElementFlag(elementId, 'visible', visible, options)
  },

  toggleElementLock: (elementId: string, options?: EVENT_OPTIONS): boolean => {
    const element = core.getElementData(elementId)
    if (!element || element.type === EntityTypes.WORKSPACE) {
      return false
    }

    return setElementFlag(elementId, 'lock', !element.lock, options)
  },

  toggleElementVisible: (
    elementId: string,
    options?: EVENT_OPTIONS
  ): boolean => {
    const element = core.getElementData(elementId)
    if (!element || element.type === EntityTypes.WORKSPACE) {
      return false
    }

    return setElementFlag(elementId, 'visible', !element.visible, options)
  },

  getElementBounds: (elementId: string): ElementBounds | null => {
    const computed = core.getElementComputedData(elementId)
    if (!computed) {
      return null
    }

    const { x, y, width, height } = computed as Partial<ElementBounds>

    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number'
    ) {
      return null
    }

    return { x, y, width, height }
  },

  getElementClientBounds: (elementId: string): ElementBounds | null => {
    const bounds = elementApis.getElementBounds(elementId)
    if (!bounds || !core.hasProjectedElement(elementId)) {
      return null
    }

    const corners = [
      { x: 0, y: 0 },
      { x: bounds.width, y: 0 },
      { x: bounds.width, y: bounds.height },
      { x: 0, y: bounds.height }
    ].map((point) => {
      const workspacePoint = core.elementLocalToWorkspace(elementId, point)
      return workspacePoint
        ? viewportApis.getCanvasPositionFromWorkspace(workspacePoint)
        : null
    })
    if (corners.some((point) => point === null)) {
      return null
    }
    const resolvedCorners = corners as PositionData[]
    const values = resolvedCorners.flatMap(({ x, y }) => [x, y])
    if (values.some((value) => !Number.isFinite(value))) {
      return null
    }

    const canvasBounds = core.getCanvasBounds()
    const canvasLeft = canvasBounds?.left ?? 0
    const canvasTop = canvasBounds?.top ?? 0
    const minX = Math.min(...resolvedCorners.map(({ x }) => x)) + canvasLeft
    const minY = Math.min(...resolvedCorners.map(({ y }) => y)) + canvasTop
    const maxX = Math.max(...resolvedCorners.map(({ x }) => x)) + canvasLeft
    const maxY = Math.max(...resolvedCorners.map(({ y }) => y)) + canvasTop

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  },

  getElementPosition: (elementId: string): PositionData | null => {
    const bounds = elementApis.getElementBounds(elementId)
    if (!bounds) {
      return null
    }

    return {
      x: bounds.x,
      y: bounds.y
    }
  },

  getPositionInParent: (
    parentId: string,
    workspacePosition: PositionData
  ): PositionData | null => {
    if (
      typeof parentId !== 'string' ||
      parentId.length === 0 ||
      !Number.isFinite(workspacePosition.x) ||
      !Number.isFinite(workspacePosition.y)
    ) {
      return null
    }

    if (parentId === core.getCurrentWorkspaceId()) {
      return {
        x: workspacePosition.x,
        y: workspacePosition.y
      }
    }

    const parent = core.getElementData(parentId)
    if (parent?.type !== EntityTypes.GROUP) {
      return null
    }

    const localPosition = core.workspaceToElementLocal(
      parentId,
      workspacePosition
    )
    if (!localPosition) return null
    if (
      !Number.isFinite(localPosition.x) ||
      !Number.isFinite(localPosition.y)
    ) {
      return null
    }

    return {
      x: localPosition.x,
      y: localPosition.y
    }
  },

  isPointInsideElement: (
    elementId: string,
    point: { x: number; y: number },
    padding = 0
  ): boolean => {
    const bounds = elementApis.getElementBounds(elementId)
    if (!bounds) {
      return false
    }

    const minX = bounds.x - padding
    const minY = bounds.y - padding
    const maxX = bounds.x + bounds.width + padding
    const maxY = bounds.y + bounds.height + padding

    return (
      point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
    )
  },

  getMousePosInWorkspace: (clientPos: { x: number; y: number }) => {
    return core.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
  },

  createElementsInParent: (
    descriptors: readonly PreparedElementDescriptor[],
    parentId: string,
    options?: EVENT_OPTIONS
  ): readonly string[] | null => {
    if (descriptors.length === 0) {
      return Object.freeze([])
    }
    if (parentId.length === 0) {
      return null
    }

    const orderedElementIds = core.createElementsInParent(
      descriptors,
      parentId,
      undefined,
      options
    )
    return Object.freeze([...orderedElementIds])
  },

  createElements: (
    createOptions: readonly CreateElementOptions[],
    options?: EVENT_OPTIONS
  ): readonly (string | null)[] => {
    if (createOptions.length === 0) {
      return []
    }
    if (createOptions.every(({ type }) => type === 'vector')) {
      const parentId = createOptions[0].parentId ?? core.getCurrentWorkspaceId()
      if (
        !parentId ||
        createOptions.some(
          (elementOptions) =>
            (elementOptions.parentId ?? core.getCurrentWorkspaceId()) !==
            parentId
        )
      ) {
        return createOptions.map(() => null)
      }
      return (
        vectorApis.createVectorElementsInParent(
          createOptions,
          parentId,
          options
        ) ?? createOptions.map(() => null)
      )
    }
    return createOptions.map((elementOptions) =>
      elementApis.createElement(elementOptions, options)
    )
  },

  createElement: (
    createOptions: CreateElementOptions,
    options?: EVENT_OPTIONS
  ): string | null => {
    if (createOptions.type === 'vector') {
      return vectorApis.createVectorElement(createOptions, options)
    }

    let workspacePos: PositionData | null = null
    if (
      createOptions.workspacePosition &&
      Number.isFinite(createOptions.workspacePosition.x) &&
      Number.isFinite(createOptions.workspacePosition.y)
    ) {
      workspacePos = createOptions.workspacePosition
    } else if (createOptions.clientPosition) {
      workspacePos = core.getMousePosInWorkspace({
        clientX: createOptions.clientPosition.x,
        clientY: createOptions.clientPosition.y
      })
    }
    if (!workspacePos) {
      return null
    }
    const parentId = createOptions.parentId ?? core.getCurrentWorkspaceId()

    const initialData: Record<string, DataTypes> = {
      fills: createOptions.fills ?? getDefaultFillsForType(createOptions.type)
    }

    if (createOptions.width !== undefined) {
      initialData.width = createOptions.width
    }
    if (createOptions.height !== undefined) {
      initialData.height = createOptions.height
    }
    if (createOptions.strokes !== undefined) {
      initialData.strokes = createOptions.strokes
    }

    return createElementAtWorkspacePos(
      createOptions.type,
      workspacePos,
      parentId,
      initialData,
      options,
      createOptions.parentWorkspaceOrigin
    )
  },

  deleteElement: (elementId: string, options?: EVENT_OPTIONS): boolean => {
    const element = core.getElementData(elementId)
    if (!element || element.type === EntityTypes.WORKSPACE) {
      return false
    }

    return runTransaction(
      () => core.removeSubtree(elementId, options).removed.length > 0
    )
  },

  resetElementSize: (elementId: string, options?: EVENT_OPTIONS) => {
    elementApis.changeElementGeometry(
      elementId,
      {
        width: DEFAULT_ELEMENT_SIZE,
        height: DEFAULT_ELEMENT_SIZE
      },
      options
    )
  },

  changeElementGeometry: (
    elementId: string,
    geometry: Partial<ElementBounds>,
    options?: EVENT_OPTIONS
  ) => {
    applyElementPropertyUpdate([elementId], geometry, options)
  },

  normalizeGroupGeometryForElements: (
    elementIds: string[],
    options?: EVENT_OPTIONS
  ) => {
    const uniqueElementIds = [...new Set(elementIds)]
    if (uniqueElementIds.length === 0) {
      return
    }

    normalizeGroupsForElements(core, uniqueElementIds, options)
  },

  setElementPositions: (
    positionsById: Record<string, PositionData>,
    options?: EVENT_OPTIONS
  ) => {
    const entries = Object.entries(positionsById ?? {})
    if (entries.length === 0) {
      return
    }

    runTransaction(() => {
      const propertyUpdates: {
        elementId: string
        values: Readonly<Record<string, unknown>>
      }[] = []

      entries.forEach(([elementId, position]) => {
        if (
          typeof position?.x !== 'number' ||
          typeof position?.y !== 'number'
        ) {
          return
        }

        const currentPosition = elementApis.getElementPosition(elementId)
        if (!currentPosition) {
          return
        }

        if (
          currentPosition.x === position.x &&
          currentPosition.y === position.y
        ) {
          return
        }

        propertyUpdates.push({
          elementId,
          values: {
            x: position.x,
            y: position.y
          }
        })
      })

      if (propertyUpdates.length > 0) {
        core.updateElementProperties(propertyUpdates, options)
      }
    })
  },

  hasMovedBeyondThreshold: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number },
    threshold: number
  ) => {
    const dragStartWorkspace = core.getMousePosInWorkspace({
      clientX: clientDragStart.x,
      clientY: clientDragStart.y
    })
    const currentWorkspace = core.getMousePosInWorkspace({
      clientX: clientCurrentPos.x,
      clientY: clientCurrentPos.y
    })

    return (
      Math.abs(currentWorkspace.x - dragStartWorkspace.x) > threshold ||
      Math.abs(currentWorkspace.y - dragStartWorkspace.y) > threshold
    )
  },

  updateElementProperties: applyElementPropertyUpdate,

  patchElementProperties: (
    patches: readonly ElementPropertyPatchUpdate[],
    options?: EVENT_OPTIONS
  ) => runTransaction(() => core.patchElementProperties(patches, options)),

  ...vectorApis
}
