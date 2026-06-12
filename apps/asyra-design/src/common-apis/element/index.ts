/**
 * Element Utility APIs - common element operations
 * Used in: create-element, and future features
 */

import { startTransaction, endTransaction } from '@asyra/reactive-events'
import {
  DEFAULT_ELEMENT_SIZE,
  EntityTypes,
  createDefaultFills,
  type EntityType,
  type DataTypes,
  type PositionData,
  type EVENT_OPTIONS,
  type GroupInstanceTypes
} from '@asyra/utils'
import core, { render, sceneTree } from '../../contexts'
import {
  DEFAULT_ELEMENT_FILL_COLOR,
  DEFAULT_FRAME_FILL_COLOR
} from '../../constants'
import type { CreateElementOptions, ElementBounds } from './types'
import { vectorApis } from './vector-apis'
import { changeComputedData as applyComputedDataChange } from './change-computed-data'

export type { VectorPointTarget } from './types'
export { vectorGeometry, type VectorPointUpdate } from './vector-apis'

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
  const element = sceneTree.getElementById(elementId)
  if (!element || element.get('type') === EntityTypes.WORKSPACE) {
    return false
  }

  if (element.get(key) === value) {
    return false
  }

  const resolvedOptions = resolveEventOptions(options)

  startTransaction()
  try {
    element.set(key, value, resolvedOptions)
    sceneTree.commitSceneTreeTransaction(resolvedOptions)
  } finally {
    endTransaction()
  }

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
  const maybeGetter = element as { get?: (key: string) => unknown }
  const value = maybeGetter.get?.('children')
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (childId): childId is string => typeof childId === 'string'
  )
}

const getWorkspaceOrderedElementIds = (): string[] => {
  const workspace =
    sceneTree.currentWorkspace ?? sceneTree.getElementById(sceneTree.workspace)
  if (!workspace) {
    return []
  }

  const orderedIds: string[] = []
  const visit = (elementId: string) => {
    const element = sceneTree.getElementById(elementId)
    if (!element) {
      return
    }

    const elementType = element.get('type') as string
    const isContainer = isContainerType(elementType)

    if (isContainer) {
      const elementData = (element as { data?: Record<string, unknown> }).data
      const canReadChildren =
        elementData &&
        Object.prototype.hasOwnProperty.call(elementData, 'children')
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
  extraData: Record<string, DataTypes> = {},
  options?: EVENT_OPTIONS
): string => {
  startTransaction()
  const elementId = core.createElement(
    {
      type,
      x: workspacePos.x,
      y: workspacePos.y,
      ...extraData
    },
    undefined,
    undefined,
    options
  )
  endTransaction()

  return elementId
}

export const elementApis = {
  isContainerType: (type: string): boolean => {
    return isContainerType(type)
  },

  getElementIdAtWorkspacePos: (workspacePos: PositionData): string | null => {
    const orderedIds = getWorkspaceOrderedElementIds()
    for (let i = orderedIds.length - 1; i >= 0; i -= 1) {
      const elementId = orderedIds[i]
      const element = sceneTree.getElementById(elementId)
      if (!element) {
        continue
      }

      const type = element.get('type')
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
      const element = sceneTree.getElementById(elementId)
      if (!element) {
        return false
      }

      if (element.get('type') === EntityTypes.WORKSPACE) {
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
    if (!render) {
      return null
    }

    return render.getElementIdAtClientPos(clientPos)
  },

  getElementType: (elementId: string): string | undefined => {
    return sceneTree.getElementById(elementId)?.get('type')
  },

  isElementLocked: (elementId: string): boolean => {
    const lockValue = sceneTree.getElementById(elementId)?.get('lock')
    return lockValue === true
  },

  isElementVisible: (elementId: string): boolean => {
    const visibleValue = sceneTree.getElementById(elementId)?.get('visible')
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
    const element = sceneTree.getElementById(elementId)
    if (!element || element.get('type') === EntityTypes.WORKSPACE) {
      return false
    }

    return setElementFlag(elementId, 'lock', !element.get('lock'), options)
  },

  toggleElementVisible: (
    elementId: string,
    options?: EVENT_OPTIONS
  ): boolean => {
    const element = sceneTree.getElementById(elementId)
    if (!element || element.get('type') === EntityTypes.WORKSPACE) {
      return false
    }

    return setElementFlag(
      elementId,
      'visible',
      !element.get('visible'),
      options
    )
  },

  getElementBounds: (elementId: string): ElementBounds | null => {
    const element = sceneTree.getElementById(elementId)
    if (!element) {
      return null
    }

    const computed = element.getAllComputedData() as Partial<ElementBounds>
    const { x, y, width, height } = computed

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
    if (!render) {
      return null
    }

    return render.getMousePosInWorkspace({
      clientX: clientPos.x,
      clientY: clientPos.y
    })
  },

  createElement: (
    createOptions: CreateElementOptions,
    options?: EVENT_OPTIONS
  ): string | null => {
    if (createOptions.type === 'vector') {
      return vectorApis.createVectorElement(createOptions, options)
    }

    if (!render || !createOptions.clientPosition) {
      return null
    }

    const workspacePos = render.getMousePosInWorkspace({
      clientX: createOptions.clientPosition.x,
      clientY: createOptions.clientPosition.y
    })

    return createElementAtWorkspacePos(
      createOptions.type,
      workspacePos,
      {
        width: 0,
        height: 0,
        fills: getDefaultFillsForType(createOptions.type)
      },
      options
    )
  },

  deleteElement: (elementId: string, options?: EVENT_OPTIONS): boolean => {
    const element = sceneTree.getElementById(elementId)
    if (!element || element.get('type') === EntityTypes.WORKSPACE) {
      return false
    }

    const parentId = element.get('parentId') as string
    if (!parentId) {
      return false
    }

    const parent = sceneTree.getElementById(parentId) as
      | GroupInstanceTypes
      | undefined
    if (!parent) {
      return false
    }

    startTransaction()
    try {
      return sceneTree.removeElement({ id: elementId }, parent, options)
    } finally {
      endTransaction()
    }
  },

  resetElementSize: (elementId: string) => {
    applyComputedDataChange([elementId], {
      width: DEFAULT_ELEMENT_SIZE,
      height: DEFAULT_ELEMENT_SIZE
    })
  },

  setElementPositions: (
    positionsById: Record<string, PositionData>,
    options?: EVENT_OPTIONS
  ) => {
    const entries = Object.entries(positionsById ?? {})
    if (entries.length === 0) {
      return
    }

    startTransaction()
    try {
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

        if (elementApis.getElementType(elementId) === 'vector') {
          vectorApis.setVectorElementPosition(elementId, position, options)
          return
        }

        core.changeComputedData(
          [elementId],
          {
            x: position.x,
            y: position.y
          },
          options
        )
      })
    } finally {
      endTransaction()
    }
  },

  hasMovedBeyondThreshold: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number },
    threshold: number
  ) => {
    if (!render) {
      return false
    }

    const dragStartWorkspace = render.getMousePosInWorkspace({
      clientX: clientDragStart.x,
      clientY: clientDragStart.y
    })
    const currentWorkspace = render.getMousePosInWorkspace({
      clientX: clientCurrentPos.x,
      clientY: clientCurrentPos.y
    })

    return (
      Math.abs(currentWorkspace.x - dragStartWorkspace.x) > threshold ||
      Math.abs(currentWorkspace.y - dragStartWorkspace.y) > threshold
    )
  },

  changeComputedData: applyComputedDataChange,

  ...vectorApis
}
