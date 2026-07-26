import type {
  AiActionDefinition,
  AiActionSchemaIssue,
  AiActionSchemaResult,
  AiExecutionContext
} from '@asyra/ai-agent-runtime'
import {
  VECTOR_HANDLE_MODES,
  VECTOR_TOKENS,
  VECTOR_TOPOLOGY_NETWORK_ID_TYPE,
  VECTOR_TOPOLOGY_POINT_ID_TYPE,
  VECTOR_TOPOLOGY_SEGMENT_ID_TYPE,
  type VectorNetwork,
  type VectorPointNode,
  type VectorSegment
} from '@asyra/core'
import {
  StrokeCapTypes,
  StrokeJoinTypes,
  createDefaultFills,
  createDefaultStrokes,
  id,
  type EVENT_OPTIONS
} from '@asyra/utils'
import {
  elementApis,
  hierarchyApis,
  selectionApis,
  strokeApis
} from '../common-apis'

export const AsyraDesignAiActionNames = Object.freeze({
  INSERT_VECTOR_COMPOSITION: 'insert_vector_composition',
  REMOVE_AI_COMPOSITION: 'remove_ai_composition',
  SET_ELEMENT_VISIBILITY: 'set_element_visibility',
  SELECT_ELEMENTS: 'select_elements',
  UPDATE_COMPOSITION_ELEMENTS: 'update_composition_elements'
} as const)

export const ASYRA_DESIGN_AI_SELECTION_LIMIT = 100
export const ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT = 24
export const ASYRA_DESIGN_AI_COMPOSITION_POINT_LIMIT = 16
export const ASYRA_DESIGN_AI_WORKSPACE_LIMIT = 2048
export const ASYRA_DESIGN_AI_SCALE_MIN = 0.5
export const ASYRA_DESIGN_AI_SCALE_MAX = 2

const AI_MUTATION_OPTIONS: EVENT_OPTIONS = Object.freeze({
  sharedDelivery: 'transaction-end',
  undoable: true
})

export interface SetElementVisibilityArgs {
  readonly elementId: string
  readonly visible: boolean
}

export interface SelectElementsArgs {
  readonly elementIds: readonly string[]
}

export interface AsyraDesignAiCompositionBounds {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

export interface AsyraDesignAiCompositionPoint {
  readonly x: number
  readonly y: number
}

export interface AsyraDesignAiCompositionStyle {
  readonly fillColor?: string
  readonly strokeColor?: string
  readonly strokeWidth?: number
}

export interface AsyraDesignAiCompositionItem {
  readonly bounds: AsyraDesignAiCompositionBounds
  readonly closed?: boolean
  readonly points?: readonly AsyraDesignAiCompositionPoint[]
  readonly primitive: 'oval' | 'vector'
  readonly role: string
  readonly style: AsyraDesignAiCompositionStyle
}

export interface InsertVectorCompositionArgs {
  readonly compositionRole: string
  readonly items: readonly AsyraDesignAiCompositionItem[]
  readonly parent: 'workspace'
}

export interface UpdateCompositionGeometry {
  readonly scaleX: number
  readonly scaleY: number
}

export interface UpdateCompositionStyle {
  readonly strokeColor: string
}

export type UpdateCompositionItem =
  | {
      readonly elementId: string
      readonly geometry: UpdateCompositionGeometry
    }
  | {
      readonly elementId: string
      readonly style: UpdateCompositionStyle
    }

export interface UpdateCompositionElementsArgs {
  readonly updates: readonly UpdateCompositionItem[]
}

export interface RemoveAiCompositionArgs {
  readonly compositionId: string
}

export interface AsyraDesignAiActionApis {
  changeElementGeometry(
    elementId: string,
    geometry: AsyraDesignAiCompositionBounds,
    options?: EVENT_OPTIONS
  ): void
  createCompositionElement(
    item: AsyraDesignAiCompositionItem,
    options?: EVENT_OPTIONS
  ): string | null
  getElementBounds(elementId: string): AsyraDesignAiCompositionBounds | null
  getElementStrokeColor(elementId: string): string | null
  getElementType(elementId: string): string | undefined
  groupElements(
    elementIds: readonly string[],
    options?: EVENT_OPTIONS
  ): { readonly groupId: string }
  removeSubtree(
    elementId: string,
    options?: EVENT_OPTIONS
  ): {
    readonly removed: readonly (
      | string
      | {
          readonly elementId: string
        }
    )[]
  }
  setElementVisible(
    elementId: string,
    visible: boolean,
    options?: EVENT_OPTIONS
  ): boolean
  selectElements(elementIds: string[], options?: EVENT_OPTIONS): void
  updateElementStrokeColor(
    elementId: string,
    color: string,
    options?: EVENT_OPTIONS
  ): boolean
}

export class AsyraDesignAiActionError extends Error {
  readonly code = 'AI_APP_ACTION_ABORTED' as const

  constructor() {
    super('Asyra Design AI action was aborted.')
    this.name = 'AsyraDesignAiActionError'
  }
}

export class AsyraDesignAiCompositionError extends Error {
  readonly code = 'AI_APP_COMPOSITION_INCONSISTENT' as const

  constructor(message: string) {
    super(message)
    this.name = 'AsyraDesignAiCompositionError'
  }
}

const createVectorTopology = (
  sourcePoints: readonly AsyraDesignAiCompositionPoint[],
  closed: boolean
): {
  readonly networks: Record<string, VectorNetwork>
  readonly points: Record<string, VectorPointNode>
  readonly segments: Record<string, VectorSegment>
} => {
  const pointIds = sourcePoints.map(() => id(VECTOR_TOPOLOGY_POINT_ID_TYPE))
  const points: Record<string, VectorPointNode> = {}
  sourcePoints.forEach((point, index) => {
    const pointId = pointIds[index]
    points[pointId] = {
      anchorType: 'sharp',
      handleMode: VECTOR_HANDLE_MODES.NONE,
      id: pointId,
      kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
      x: point.x,
      y: point.y
    }
  })

  const segmentPairs: { endId: string; startId: string }[] = []
  for (let index = 1; index < pointIds.length; index += 1) {
    segmentPairs.push({
      endId: pointIds[index],
      startId: pointIds[index - 1]
    })
  }
  if (closed) {
    segmentPairs.push({
      endId: pointIds[0],
      startId: pointIds[pointIds.length - 1]
    })
  }

  const segments: Record<string, VectorSegment> = {}
  const segmentIds = segmentPairs.map(({ endId, startId }) => {
    const segmentId = id(VECTOR_TOPOLOGY_SEGMENT_ID_TYPE)
    segments[segmentId] = {
      endId,
      id: segmentId,
      inControlId: null,
      outControlId: null,
      startId
    }
    return segmentId
  })
  const networkId = id(VECTOR_TOPOLOGY_NETWORK_ID_TYPE)
  return {
    networks: {
      [networkId]: {
        closed,
        id: networkId,
        pointIds,
        segmentIds
      }
    },
    points,
    segments
  }
}

const createCompositionElement = (
  item: AsyraDesignAiCompositionItem,
  options?: EVENT_OPTIONS
): string | null => {
  const fills =
    item.style.fillColor === undefined
      ? []
      : createDefaultFills({
          color: item.style.fillColor
        })
  const strokes =
    item.style.strokeColor === undefined
      ? []
      : createDefaultStrokes({
          capType: StrokeCapTypes.ROUND,
          color: item.style.strokeColor,
          joinType: StrokeJoinTypes.ROUND,
          width: item.style.strokeWidth ?? 1
        })

  if (item.primitive === 'oval') {
    return elementApis.createElement(
      {
        fills,
        height: item.bounds.height,
        parentId: hierarchyApis.getWorkspaceId() ?? undefined,
        strokes,
        type: 'oval',
        width: item.bounds.width,
        workspacePosition: {
          x: item.bounds.x,
          y: item.bounds.y
        }
      },
      options
    )
  }

  const topology = createVectorTopology(item.points ?? [], item.closed === true)
  return elementApis.createElement(
    {
      closed: item.closed,
      fills,
      networks: topology.networks,
      points: topology.points,
      segments: topology.segments,
      strokes,
      type: 'vector'
    },
    options
  )
}

const defaultApis: AsyraDesignAiActionApis = {
  changeElementGeometry: (elementId, geometry, options) =>
    elementApis.changeElementGeometry(elementId, geometry, options),
  createCompositionElement,
  getElementBounds: (elementId) => elementApis.getElementBounds(elementId),
  getElementStrokeColor: (elementId) =>
    strokeApis.getPrimaryStrokeColor(elementId),
  getElementType: (elementId) => elementApis.getElementType(elementId),
  groupElements: (elementIds, options) =>
    hierarchyApis.groupElements(elementIds, options),
  removeSubtree: (elementId, options) =>
    hierarchyApis.removeSubtree(elementId, options),
  setElementVisible: (elementId, visible, options) =>
    elementApis.setElementVisible(elementId, visible, options),
  selectElements: (elementIds, options) =>
    selectionApis.selectElements(elementIds, options),
  updateElementStrokeColor: (elementId, color, options) =>
    strokeApis.updatePrimaryStrokeColor(elementId, color, options)
}

const invalidArguments = (
  code: string,
  path: readonly (number | string)[]
): AiActionSchemaResult<never> => {
  const issue: AiActionSchemaIssue = Object.freeze({
    code,
    message: 'Action arguments do not match the registered schema.',
    path: Object.freeze([...path])
  })
  return Object.freeze({
    success: false,
    issues: Object.freeze([issue])
  })
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const readExactObject = (
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const ownKeys = Reflect.ownKeys(value)
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
  ) {
    return null
  }

  const result: Record<string, unknown> = {}
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return null
    }
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value: descriptor.value,
      writable: true
    })
  }
  return result
}

const readArray = (value: unknown): unknown[] | null => {
  if (!Array.isArray(value)) {
    return null
  }
  const result: unknown[] = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return null
    }
    result.push(descriptor.value)
  }
  return result
}

const semanticRole = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 80 &&
  /^[a-z0-9][a-z0-9-]*$/i.test(value)

const canonicalElementId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 256

const hexColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

const finiteInRange = (value: unknown, minimum: number, maximum: number) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum

const parseBounds = (value: unknown): AsyraDesignAiCompositionBounds | null => {
  const object = readExactObject(value, ['height', 'width', 'x', 'y'])
  if (
    !object ||
    !finiteInRange(object.x, 0, ASYRA_DESIGN_AI_WORKSPACE_LIMIT) ||
    !finiteInRange(object.y, 0, ASYRA_DESIGN_AI_WORKSPACE_LIMIT) ||
    !finiteInRange(object.width, 1, ASYRA_DESIGN_AI_WORKSPACE_LIMIT) ||
    !finiteInRange(object.height, 1, ASYRA_DESIGN_AI_WORKSPACE_LIMIT)
  ) {
    return null
  }
  const x = object.x as number
  const y = object.y as number
  const width = object.width as number
  const height = object.height as number
  if (
    x + width > ASYRA_DESIGN_AI_WORKSPACE_LIMIT ||
    y + height > ASYRA_DESIGN_AI_WORKSPACE_LIMIT
  ) {
    return null
  }
  return Object.freeze({ height, width, x, y })
}

const parseStyle = (value: unknown): AsyraDesignAiCompositionStyle | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const keys = Reflect.ownKeys(value)
  const allowed = ['fillColor', 'strokeColor', 'strokeWidth']
  if (
    keys.length === 0 ||
    keys.some((key) => typeof key !== 'string' || !allowed.includes(key))
  ) {
    return null
  }
  const object = readExactObject(value, keys as string[])
  if (
    !object ||
    (object.fillColor !== undefined && !hexColor(object.fillColor)) ||
    (object.strokeColor !== undefined && !hexColor(object.strokeColor)) ||
    (object.strokeWidth !== undefined &&
      !finiteInRange(object.strokeWidth, 1, 20)) ||
    (object.strokeWidth !== undefined && object.strokeColor === undefined)
  ) {
    return null
  }
  return Object.freeze({
    ...(object.fillColor === undefined
      ? {}
      : { fillColor: object.fillColor as string }),
    ...(object.strokeColor === undefined
      ? {}
      : { strokeColor: object.strokeColor as string }),
    ...(object.strokeWidth === undefined
      ? {}
      : { strokeWidth: object.strokeWidth as number })
  })
}

const parsePoints = (
  value: unknown,
  bounds: AsyraDesignAiCompositionBounds
): readonly AsyraDesignAiCompositionPoint[] | null => {
  const source = readArray(value)
  if (
    !source ||
    source.length < 2 ||
    source.length > ASYRA_DESIGN_AI_COMPOSITION_POINT_LIMIT
  ) {
    return null
  }
  const points: AsyraDesignAiCompositionPoint[] = []
  for (const entry of source) {
    const object = readExactObject(entry, ['x', 'y'])
    if (
      !object ||
      !finiteInRange(object.x, bounds.x, bounds.x + bounds.width) ||
      !finiteInRange(object.y, bounds.y, bounds.y + bounds.height)
    ) {
      return null
    }
    points.push(
      Object.freeze({
        x: object.x as number,
        y: object.y as number
      })
    )
  }
  return Object.freeze(points)
}

const parseCompositionItem = (
  value: unknown
): AsyraDesignAiCompositionItem | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const primitiveDescriptor = Object.getOwnPropertyDescriptor(
    value,
    'primitive'
  )
  if (!primitiveDescriptor?.enumerable || !('value' in primitiveDescriptor)) {
    return null
  }
  const primitive = primitiveDescriptor.value
  const keys =
    primitive === 'vector'
      ? ['bounds', 'closed', 'points', 'primitive', 'role', 'style']
      : ['bounds', 'primitive', 'role', 'style']
  const object = readExactObject(value, keys)
  const bounds = parseBounds(object?.bounds)
  const style = parseStyle(object?.style)
  if (
    !object ||
    (primitive !== 'oval' && primitive !== 'vector') ||
    !semanticRole(object.role) ||
    !bounds ||
    !style
  ) {
    return null
  }
  if (primitive === 'oval') {
    return Object.freeze({
      bounds,
      primitive,
      role: object.role,
      style
    })
  }
  if (typeof object.closed !== 'boolean') {
    return null
  }
  const points = parsePoints(object.points, bounds)
  if (!points || (object.closed && points.length < 3)) {
    return null
  }
  return Object.freeze({
    bounds,
    closed: object.closed,
    points,
    primitive,
    role: object.role,
    style
  })
}

const parseInsertComposition = (
  value: unknown
): AiActionSchemaResult<InsertVectorCompositionArgs> => {
  const object = readExactObject(value, ['compositionRole', 'items', 'parent'])
  const sourceItems = readArray(object?.items)
  if (
    !object ||
    !semanticRole(object.compositionRole) ||
    object.parent !== 'workspace' ||
    !sourceItems ||
    sourceItems.length < 2 ||
    sourceItems.length > ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT
  ) {
    return invalidArguments('invalid_composition_arguments', [])
  }
  const items: AsyraDesignAiCompositionItem[] = []
  for (const source of sourceItems) {
    const item = parseCompositionItem(source)
    if (!item) {
      return invalidArguments('invalid_composition_item', ['items'])
    }
    items.push(item)
  }
  return Object.freeze({
    success: true,
    value: Object.freeze({
      compositionRole: object.compositionRole,
      items: Object.freeze(items),
      parent: 'workspace'
    })
  })
}

const parseUpdateComposition = (
  value: unknown
): AiActionSchemaResult<UpdateCompositionElementsArgs> => {
  const object = readExactObject(value, ['updates'])
  const sourceUpdates = readArray(object?.updates)
  if (
    !object ||
    !sourceUpdates ||
    sourceUpdates.length === 0 ||
    sourceUpdates.length > ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT
  ) {
    return invalidArguments('invalid_composition_updates', ['updates'])
  }
  const updates: UpdateCompositionItem[] = []
  for (let index = 0; index < sourceUpdates.length; index += 1) {
    const source = sourceUpdates[index]
    if (!isPlainObject(source)) {
      return invalidArguments('invalid_composition_update', ['updates', index])
    }
    const keys = Reflect.ownKeys(source)
    const hasGeometry = keys.includes('geometry')
    const hasStyle = keys.includes('style')
    if (hasGeometry === hasStyle) {
      return invalidArguments('invalid_composition_update', ['updates', index])
    }
    const update = readExactObject(source, [
      'elementId',
      hasGeometry ? 'geometry' : 'style'
    ])
    if (!update || !canonicalElementId(update.elementId)) {
      return invalidArguments('invalid_composition_target', ['updates', index])
    }
    if (hasGeometry) {
      const geometry = readExactObject(update.geometry, ['scaleX', 'scaleY'])
      if (
        !geometry ||
        !finiteInRange(
          geometry.scaleX,
          ASYRA_DESIGN_AI_SCALE_MIN,
          ASYRA_DESIGN_AI_SCALE_MAX
        ) ||
        !finiteInRange(
          geometry.scaleY,
          ASYRA_DESIGN_AI_SCALE_MIN,
          ASYRA_DESIGN_AI_SCALE_MAX
        ) ||
        (geometry.scaleX === 1 && geometry.scaleY === 1)
      ) {
        return invalidArguments('invalid_composition_geometry', [
          'updates',
          index
        ])
      }
      updates.push(
        Object.freeze({
          elementId: update.elementId,
          geometry: Object.freeze({
            scaleX: geometry.scaleX as number,
            scaleY: geometry.scaleY as number
          })
        })
      )
      continue
    }
    const style = readExactObject(update.style, ['strokeColor'])
    if (!style || !hexColor(style.strokeColor)) {
      return invalidArguments('invalid_composition_style', ['updates', index])
    }
    updates.push(
      Object.freeze({
        elementId: update.elementId,
        style: Object.freeze({
          strokeColor: style.strokeColor
        })
      })
    )
  }
  return Object.freeze({
    success: true,
    value: Object.freeze({
      updates: Object.freeze(updates)
    })
  })
}

const parseRemoveComposition = (
  value: unknown
): AiActionSchemaResult<RemoveAiCompositionArgs> => {
  const object = readExactObject(value, ['compositionId'])
  if (!object || !canonicalElementId(object.compositionId)) {
    return invalidArguments('invalid_composition_removal', [])
  }
  return Object.freeze({
    success: true,
    value: Object.freeze({
      compositionId: object.compositionId
    })
  })
}

const parseVisibility = (
  value: unknown
): AiActionSchemaResult<SetElementVisibilityArgs> => {
  const object = readExactObject(value, ['elementId', 'visible'])
  if (
    !object ||
    typeof object.elementId !== 'string' ||
    object.elementId.trim().length === 0 ||
    typeof object.visible !== 'boolean'
  ) {
    return invalidArguments('invalid_visibility_arguments', [])
  }

  return Object.freeze({
    success: true,
    value: Object.freeze({
      elementId: object.elementId,
      visible: object.visible
    })
  })
}

const parseSelection = (
  value: unknown
): AiActionSchemaResult<SelectElementsArgs> => {
  const object = readExactObject(value, ['elementIds'])
  if (!object || !Array.isArray(object.elementIds)) {
    return invalidArguments('invalid_selection_arguments', ['elementIds'])
  }

  const elementIds: string[] = []
  const seen = new Set<string>()
  if (
    object.elementIds.length === 0 ||
    object.elementIds.length > ASYRA_DESIGN_AI_SELECTION_LIMIT
  ) {
    return invalidArguments('invalid_selection_size', ['elementIds'])
  }

  for (let index = 0; index < object.elementIds.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(
      object.elementIds,
      String(index)
    )
    if (
      !descriptor?.enumerable ||
      !('value' in descriptor) ||
      typeof descriptor.value !== 'string' ||
      descriptor.value.trim().length === 0 ||
      seen.has(descriptor.value)
    ) {
      return invalidArguments('invalid_selection_id', ['elementIds', index])
    }
    seen.add(descriptor.value)
    elementIds.push(descriptor.value)
  }

  return Object.freeze({
    success: true,
    value: Object.freeze({
      elementIds: Object.freeze(elementIds)
    })
  })
}

const assertNotAborted = (context: AiExecutionContext): void => {
  if (context.signal.aborted) {
    throw new AsyraDesignAiActionError()
  }
}

const statusForMutation = (
  appliedCount: number,
  skippedCount: number
): 'complete' | 'no-change' | 'partial' => {
  if (appliedCount === 0) {
    return 'no-change'
  }
  return skippedCount > 0 ? 'partial' : 'complete'
}

const createCompositionActions = (
  apis: AsyraDesignAiActionApis
): readonly AiActionDefinition[] => {
  const insert: AiActionDefinition<InsertVectorCompositionArgs> = Object.freeze(
    {
      description: `Insert 2 to ${ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT} bounded editable oval or vector elements as one grouped composition.`,
      execute: async (args, context) => {
        const accepted: AsyraDesignAiCompositionItem[] = []
        const skipped: { reason: string; role: string }[] = []
        const roles = new Set<string>()
        args.items.forEach((item) => {
          if (roles.has(item.role)) {
            skipped.push(
              Object.freeze({
                reason: 'duplicate-role',
                role: item.role
              })
            )
            return
          }
          roles.add(item.role)
          accepted.push(item)
        })

        const appliedElementIds: string[] = []
        const roleToElementIds: Record<string, readonly string[]> = {}
        const whiskers: string[] = []
        for (const item of accepted) {
          assertNotAborted(context)
          const elementId = apis.createCompositionElement(
            item,
            AI_MUTATION_OPTIONS
          )
          if (!elementId) {
            skipped.push(
              Object.freeze({
                reason: 'creation-rejected',
                role: item.role
              })
            )
            continue
          }
          appliedElementIds.push(elementId)
          roleToElementIds[item.role] = Object.freeze([elementId])
          if (item.role.includes('whisker')) {
            whiskers.push(elementId)
          }
        }

        if (appliedElementIds.length === 0) {
          return Object.freeze({
            action: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
            appliedElementIds: Object.freeze([]),
            compositionId: null,
            roleToElementIds: Object.freeze({}),
            skipped: Object.freeze(skipped),
            status: 'no-change'
          })
        }
        if (appliedElementIds.length < 2) {
          throw new AsyraDesignAiCompositionError(
            'AI composition cannot preserve grouping after item creation.'
          )
        }

        assertNotAborted(context)
        const group = apis.groupElements(appliedElementIds, AI_MUTATION_OPTIONS)
        if (!group?.groupId) {
          throw new AsyraDesignAiCompositionError(
            'AI composition grouping failed.'
          )
        }
        if (whiskers.length > 0) {
          roleToElementIds.whiskers = Object.freeze(whiskers)
        }
        return Object.freeze({
          action: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
          appliedElementIds: Object.freeze(appliedElementIds),
          compositionId: group.groupId,
          roleToElementIds: Object.freeze(roleToElementIds),
          skipped: Object.freeze(skipped),
          status: statusForMutation(appliedElementIds.length, skipped.length)
        })
      },
      name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      schema: Object.freeze({
        parse: parseInsertComposition,
        providerSchema: Object.freeze({
          additionalProperties: false,
          properties: Object.freeze({
            compositionRole: Object.freeze({ type: 'string' }),
            items: Object.freeze({
              maxItems: ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT,
              minItems: 2,
              type: 'array'
            }),
            parent: Object.freeze({
              const: 'workspace',
              type: 'string'
            })
          }),
          required: Object.freeze(['compositionRole', 'items', 'parent']),
          type: 'object'
        })
      })
    }
  )

  const update: AiActionDefinition<UpdateCompositionElementsArgs> =
    Object.freeze({
      description:
        'Apply bounded geometry or stroke-color updates to existing context-exposed composition elements.',
      execute: async (args, context) => {
        const prepared: {
          readonly elementId: string
          readonly geometry?: AsyraDesignAiCompositionBounds
          readonly strokeColor?: string
          readonly targetType: string
        }[] = []
        const skipped: { elementId: string; reason: string }[] = []
        const seen = new Set<string>()
        for (const updateItem of args.updates) {
          if (seen.has(updateItem.elementId)) {
            skipped.push(
              Object.freeze({
                elementId: updateItem.elementId,
                reason: 'duplicate-target'
              })
            )
            continue
          }
          seen.add(updateItem.elementId)
          const targetType = apis.getElementType(updateItem.elementId)
          if (!targetType) {
            skipped.push(
              Object.freeze({
                elementId: updateItem.elementId,
                reason: 'missing-target'
              })
            )
            continue
          }
          if ('geometry' in updateItem) {
            const bounds = apis.getElementBounds(updateItem.elementId)
            if (targetType !== 'oval' || !bounds) {
              skipped.push(
                Object.freeze({
                  elementId: updateItem.elementId,
                  reason: 'unsupported-target'
                })
              )
              continue
            }
            const width = bounds.width * updateItem.geometry.scaleX
            const height = bounds.height * updateItem.geometry.scaleY
            prepared.push({
              elementId: updateItem.elementId,
              geometry: Object.freeze({
                height,
                width,
                x: bounds.x - (width - bounds.width) / 2,
                y: bounds.y - (height - bounds.height) / 2
              }),
              targetType
            })
            continue
          }
          const currentColor = apis.getElementStrokeColor(updateItem.elementId)
          if (currentColor === null) {
            skipped.push(
              Object.freeze({
                elementId: updateItem.elementId,
                reason: 'missing-stroke'
              })
            )
            continue
          }
          if (currentColor === updateItem.style.strokeColor) {
            skipped.push(
              Object.freeze({
                elementId: updateItem.elementId,
                reason: 'no-change'
              })
            )
            continue
          }
          prepared.push({
            elementId: updateItem.elementId,
            strokeColor: updateItem.style.strokeColor,
            targetType
          })
        }

        const appliedElementIds: string[] = []
        for (const operation of prepared) {
          assertNotAborted(context)
          if (
            apis.getElementType(operation.elementId) !== operation.targetType
          ) {
            skipped.push(
              Object.freeze({
                elementId: operation.elementId,
                reason: 'missing-target'
              })
            )
            continue
          }
          if (operation.geometry) {
            apis.changeElementGeometry(
              operation.elementId,
              operation.geometry,
              AI_MUTATION_OPTIONS
            )
            appliedElementIds.push(operation.elementId)
            continue
          }
          if (
            operation.strokeColor &&
            apis.updateElementStrokeColor(
              operation.elementId,
              operation.strokeColor,
              AI_MUTATION_OPTIONS
            )
          ) {
            appliedElementIds.push(operation.elementId)
          } else {
            skipped.push(
              Object.freeze({
                elementId: operation.elementId,
                reason: 'no-change'
              })
            )
          }
        }
        return Object.freeze({
          action: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
          appliedElementIds: Object.freeze(appliedElementIds),
          skipped: Object.freeze(skipped),
          status: statusForMutation(appliedElementIds.length, skipped.length)
        })
      },
      name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      schema: Object.freeze({
        parse: parseUpdateComposition,
        providerSchema: Object.freeze({
          additionalProperties: false,
          properties: Object.freeze({
            updates: Object.freeze({
              maxItems: ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT,
              minItems: 1,
              type: 'array'
            })
          }),
          required: Object.freeze(['updates']),
          type: 'object'
        })
      })
    })

  const remove: AiActionDefinition<RemoveAiCompositionArgs> = Object.freeze({
    description:
      'Remove the current AI composition Group through the ordinary subtree boundary.',
    execute: async (args, context) => {
      assertNotAborted(context)
      const targetType = apis.getElementType(args.compositionId)
      if (targetType !== 'group') {
        return Object.freeze({
          action: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
          appliedElementIds: Object.freeze([]),
          skipped: Object.freeze([
            Object.freeze({
              elementId: args.compositionId,
              reason: targetType ? 'invalid-target' : 'missing-target'
            })
          ]),
          status: 'no-change'
        })
      }
      assertNotAborted(context)
      if (apis.getElementType(args.compositionId) !== 'group') {
        return Object.freeze({
          action: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
          appliedElementIds: Object.freeze([]),
          skipped: Object.freeze([
            Object.freeze({
              elementId: args.compositionId,
              reason: 'missing-target'
            })
          ]),
          status: 'no-change'
        })
      }
      const result = apis.removeSubtree(args.compositionId, AI_MUTATION_OPTIONS)
      const appliedElementIds = result.removed.map((entry) =>
        typeof entry === 'string' ? entry : entry.elementId
      )
      return Object.freeze({
        action: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
        appliedElementIds: Object.freeze(appliedElementIds),
        skipped: Object.freeze([]),
        status: statusForMutation(appliedElementIds.length, 0)
      })
    },
    name: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
    schema: Object.freeze({
      parse: parseRemoveComposition,
      providerSchema: Object.freeze({
        additionalProperties: false,
        properties: Object.freeze({
          compositionId: Object.freeze({
            minLength: 1,
            type: 'string'
          })
        }),
        required: Object.freeze(['compositionId']),
        type: 'object'
      })
    })
  })

  return Object.freeze([insert, update, remove])
}

export const createAsyraDesignAiActions = (
  apis: AsyraDesignAiActionApis = defaultApis
): readonly AiActionDefinition[] => {
  const visibility: AiActionDefinition<SetElementVisibilityArgs> =
    Object.freeze({
      name: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      description: 'Set whether one existing element is visible.',
      schema: Object.freeze({
        providerSchema: Object.freeze({
          type: 'object',
          additionalProperties: false,
          required: Object.freeze(['elementId', 'visible']),
          properties: Object.freeze({
            elementId: Object.freeze({
              type: 'string',
              minLength: 1
            }),
            visible: Object.freeze({
              type: 'boolean'
            })
          })
        }),
        parse: parseVisibility
      }),
      execute: async (
        args: SetElementVisibilityArgs,
        context: AiExecutionContext
      ) => {
        assertNotAborted(context)
        const changed = apis.setElementVisible(
          args.elementId,
          args.visible,
          AI_MUTATION_OPTIONS
        )
        return Object.freeze({
          action: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
          changed,
          elementId: args.elementId
        })
      }
    })

  const selection: AiActionDefinition<SelectElementsArgs> = Object.freeze({
    name: AsyraDesignAiActionNames.SELECT_ELEMENTS,
    description: `Select from 1 to ${ASYRA_DESIGN_AI_SELECTION_LIMIT} existing elements.`,
    schema: Object.freeze({
      providerSchema: Object.freeze({
        type: 'object',
        additionalProperties: false,
        required: Object.freeze(['elementIds']),
        properties: Object.freeze({
          elementIds: Object.freeze({
            type: 'array',
            minItems: 1,
            maxItems: ASYRA_DESIGN_AI_SELECTION_LIMIT,
            uniqueItems: true,
            items: Object.freeze({
              type: 'string',
              minLength: 1
            })
          })
        })
      }),
      parse: parseSelection
    }),
    execute: async (args: SelectElementsArgs, context: AiExecutionContext) => {
      assertNotAborted(context)
      apis.selectElements([...args.elementIds], AI_MUTATION_OPTIONS)
      return Object.freeze({
        action: AsyraDesignAiActionNames.SELECT_ELEMENTS,
        selectedCount: args.elementIds.length
      })
    }
  })

  return Object.freeze([
    ...createCompositionActions(apis),
    visibility,
    selection
  ])
}
