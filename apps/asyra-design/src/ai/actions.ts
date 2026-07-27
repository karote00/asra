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
  type CanonicalElementBatchResult,
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
  measureBrowserDragAsyncPhase,
  measureBrowserDragPhase,
  type EVENT_OPTIONS
} from '@asyra/utils'
import { deriveGroupBounds } from '@asyra/preset'
import {
  elementApis,
  fillApis,
  hierarchyApis,
  selectionApis,
  strokeApis,
  type CreateElementOptions
} from '../common-apis'
import {
  AsyraDesignAiActionNames,
  AsyraDesignAiDrawingDetailOptionIds
} from '../constants'
import {
  createAsyraDesignAiProgressiveDeliveryCoordinator,
  type AsyraDesignAiProgressiveDeliveryStage
} from './progressive-delivery'

export { AsyraDesignAiActionNames } from '../constants'

export const ASYRA_DESIGN_AI_SELECTION_LIMIT = 100
export const ASYRA_DESIGN_AI_WORKSPACE_LIMIT = 2048
export const ASYRA_DESIGN_AI_SCALE_MIN = 0.5
export const ASYRA_DESIGN_AI_SCALE_MAX = 2
export const ASYRA_DESIGN_AI_TRANSIENT_CREATE_CHUNK_SIZE = 256
export const ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET = 2048
export const ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_MAX_POINT_BUDGET = 8192

export type AsyraDesignAiDeliveryMode = 'atomic' | 'progressive'

export interface CreateAsyraDesignAiActionsOptions {
  readonly deliveryMode?: AsyraDesignAiDeliveryMode
  readonly stageProgressiveDelivery?: (
    stage: AsyraDesignAiProgressiveDeliveryStage
  ) => Promise<void> | void
  readonly yieldToHost?: () => Promise<void>
}

export const hasAsyraDesignAiCompositionMinimumItemCount = (
  count: number
): boolean => Number.isInteger(count) && count >= 1

const createAiMutationOptions = (
  deliveryMode: AsyraDesignAiDeliveryMode
): EVENT_OPTIONS =>
  Object.freeze({
    sharedDelivery:
      deliveryMode === 'progressive' ? 'immediate' : 'transaction-end',
    undoable: true
  })

const yieldToHost = (): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, 0))

export interface SetElementVisibilityArgs {
  readonly elementId: string
  readonly visible: boolean
}

export type RequestDrawingDetailChoiceArgs = Record<string, never>

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

export interface AsyraDesignAiCompositionPath {
  readonly closed: boolean
  readonly points: readonly AsyraDesignAiCompositionPoint[]
}

export interface AsyraDesignAiCompositionItem {
  readonly bounds: AsyraDesignAiCompositionBounds
  readonly closed?: boolean
  readonly paths?: readonly AsyraDesignAiCompositionPath[]
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

export type UpdateCompositionStyle =
  | {
      readonly fillColor: string
    }
  | {
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

export interface AsyraDesignAiColorUpdate {
  readonly color: string
  readonly elementId: string
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
  createCompositionElements(
    items: readonly AsyraDesignAiCompositionItem[],
    parent: {
      readonly id: string
      readonly workspaceOrigin: AsyraDesignAiCompositionPoint
    },
    options?: EVENT_OPTIONS
  ): CanonicalElementBatchResult | null
  createCompositionGroup(
    bounds: AsyraDesignAiCompositionBounds,
    options?: EVENT_OPTIONS
  ): string | null
  getElementBounds(elementId: string): AsyraDesignAiCompositionBounds | null
  getElementFillColor(elementId: string): string | null
  getElementStrokeColor(elementId: string): string | null
  getElementType(elementId: string): string | undefined
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
  scaleVectorElementGeometry(
    elementId: string,
    geometry: UpdateCompositionGeometry,
    options?: EVENT_OPTIONS
  ): boolean
  setElementVisible(
    elementId: string,
    visible: boolean,
    options?: EVENT_OPTIONS
  ): boolean
  selectElements(elementIds: string[], options?: EVENT_OPTIONS): void
  updateElementFillColor(
    elementId: string,
    color: string,
    options?: EVENT_OPTIONS
  ): boolean
  updateElementFillColors(
    updates: readonly AsyraDesignAiColorUpdate[],
    options?: EVENT_OPTIONS
  ): readonly boolean[]
  updateElementStrokeColor(
    elementId: string,
    color: string,
    options?: EVENT_OPTIONS
  ): boolean
  updateElementStrokeColors(
    updates: readonly AsyraDesignAiColorUpdate[],
    options?: EVENT_OPTIONS
  ): readonly boolean[]
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
  sourcePaths: readonly AsyraDesignAiCompositionPath[]
): {
  readonly networks: Record<string, VectorNetwork>
  readonly points: Record<string, VectorPointNode>
  readonly segments: Record<string, VectorSegment>
} => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {}

  for (const sourcePath of sourcePaths) {
    const pointIds = sourcePath.points.map(() =>
      id(VECTOR_TOPOLOGY_POINT_ID_TYPE)
    )
    sourcePath.points.forEach((point, index) => {
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
    if (sourcePath.closed) {
      segmentPairs.push({
        endId: pointIds[0],
        startId: pointIds[pointIds.length - 1]
      })
    }

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
    networks[networkId] = {
      closed: sourcePath.closed,
      id: networkId,
      pointIds,
      segmentIds
    }
  }

  return {
    networks,
    points,
    segments
  }
}

const createCompositionElementOptions = (
  item: AsyraDesignAiCompositionItem,
  parent?: {
    readonly id: string
    readonly workspaceOrigin: AsyraDesignAiCompositionPoint
  }
): CreateElementOptions => {
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
    return {
      fills,
      height: item.bounds.height,
      parentId: parent?.id ?? hierarchyApis.getWorkspaceId() ?? undefined,
      parentWorkspaceOrigin: parent?.workspaceOrigin,
      strokes,
      type: 'oval',
      width: item.bounds.width,
      workspacePosition: {
        x: item.bounds.x,
        y: item.bounds.y
      }
    }
  }

  const paths =
    item.paths ??
    Object.freeze([
      Object.freeze({
        closed: item.closed === true,
        points: item.points ?? []
      })
    ])
  const topology = createVectorTopology(paths)
  return {
    closed: item.closed,
    fills,
    networks: topology.networks,
    parentId: parent?.id ?? hierarchyApis.getWorkspaceId() ?? undefined,
    parentWorkspaceOrigin: parent?.workspaceOrigin,
    points: topology.points,
    segments: topology.segments,
    strokes,
    type: 'vector'
  }
}

const createCompositionElement = (
  item: AsyraDesignAiCompositionItem,
  options?: EVENT_OPTIONS
): string | null =>
  elementApis.createElement(createCompositionElementOptions(item), options)

const createCompositionElements = (
  items: readonly AsyraDesignAiCompositionItem[],
  parent: {
    readonly id: string
    readonly workspaceOrigin: AsyraDesignAiCompositionPoint
  },
  options?: EVENT_OPTIONS
): CanonicalElementBatchResult | null => {
  const createOptions = measureBrowserDragPhase(
    'ai-app:prepare-composition-bulk-request',
    () => items.map((item) => createCompositionElementOptions(item, parent))
  )
  return elementApis.createElementsInParentBatch(
    createOptions,
    parent.id,
    options
  )
}

const defaultApis: AsyraDesignAiActionApis = {
  changeElementGeometry: (elementId, geometry, options) =>
    elementApis.changeElementGeometry(elementId, geometry, options),
  createCompositionElement,
  createCompositionElements,
  createCompositionGroup: (bounds, options) =>
    elementApis.createElement(
      {
        fills: [],
        height: bounds.height,
        parentId: hierarchyApis.getWorkspaceId() ?? undefined,
        strokes: [],
        type: 'group',
        width: bounds.width,
        workspacePosition: {
          x: bounds.x,
          y: bounds.y
        }
      },
      options
    ),
  getElementBounds: (elementId) => elementApis.getElementBounds(elementId),
  getElementFillColor: (elementId) => fillApis.getPrimaryFillColor(elementId),
  getElementStrokeColor: (elementId) =>
    strokeApis.getPrimaryStrokeColor(elementId),
  getElementType: (elementId) => elementApis.getElementType(elementId),
  removeSubtree: (elementId, options) =>
    hierarchyApis.removeSubtree(elementId, options),
  scaleVectorElementGeometry: (elementId, geometry, options) =>
    elementApis.scaleVectorElementAroundCenter(elementId, geometry, options),
  setElementVisible: (elementId, visible, options) =>
    elementApis.setElementVisible(elementId, visible, options),
  selectElements: (elementIds, options) =>
    selectionApis.selectElements(elementIds, options),
  updateElementFillColor: (elementId, color, options) =>
    fillApis.updatePrimaryFillColor(elementId, color, options),
  updateElementFillColors: (updates, options) =>
    fillApis.updatePrimaryFillColors(updates, options),
  updateElementStrokeColor: (elementId, color, options) =>
    strokeApis.updatePrimaryStrokeColor(elementId, color, options),
  updateElementStrokeColors: (updates, options) =>
    strokeApis.updatePrimaryStrokeColors(updates, options)
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
  if (!source || source.length < 2) {
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

const parsePaths = (
  value: unknown,
  bounds: AsyraDesignAiCompositionBounds
): readonly AsyraDesignAiCompositionPath[] | null => {
  const source = readArray(value)
  if (!source || source.length === 0) {
    return null
  }
  const paths: AsyraDesignAiCompositionPath[] = []
  for (const entry of source) {
    const object = readExactObject(entry, ['closed', 'points'])
    if (!object || typeof object.closed !== 'boolean') {
      return null
    }
    const points = parsePoints(object.points, bounds)
    if (!points || (object.closed && points.length < 3)) {
      return null
    }
    paths.push(
      Object.freeze({
        closed: object.closed,
        points
      })
    )
  }
  return Object.freeze(paths)
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
  const pathsDescriptor = Object.getOwnPropertyDescriptor(value, 'paths')
  const hasPaths = pathsDescriptor?.enumerable === true
  let keys = ['bounds', 'primitive', 'role', 'style']
  if (primitive === 'vector') {
    keys = hasPaths
      ? ['bounds', 'paths', 'primitive', 'role', 'style']
      : ['bounds', 'closed', 'points', 'primitive', 'role', 'style']
  }
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
  if (hasPaths) {
    const paths = parsePaths(object.paths, bounds)
    if (!paths) {
      return null
    }
    return Object.freeze({
      bounds,
      paths,
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
    !hasAsyraDesignAiCompositionMinimumItemCount(sourceItems.length)
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
  if (!object || !sourceUpdates || sourceUpdates.length === 0) {
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
    if (!isPlainObject(update.style)) {
      return invalidArguments('invalid_composition_style', ['updates', index])
    }
    const styleKeys = Reflect.ownKeys(update.style)
    if (
      styleKeys.length !== 1 ||
      (styleKeys[0] !== 'fillColor' && styleKeys[0] !== 'strokeColor')
    ) {
      return invalidArguments('invalid_composition_style', ['updates', index])
    }
    const styleKey = styleKeys[0]
    const style = readExactObject(update.style, [styleKey])
    if (!style || !hexColor(style[styleKey])) {
      return invalidArguments('invalid_composition_style', ['updates', index])
    }
    updates.push(
      Object.freeze({
        elementId: update.elementId,
        style: Object.freeze(
          styleKey === 'fillColor'
            ? { fillColor: style.fillColor as string }
            : { strokeColor: style.strokeColor as string }
        )
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

const parseDrawingDetailChoice = (
  value: unknown
): AiActionSchemaResult<RequestDrawingDetailChoiceArgs> => {
  if (!readExactObject(value, [])) {
    return invalidArguments('invalid_drawing_detail_choice', [])
  }
  return Object.freeze({
    success: true,
    value: Object.freeze({})
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

const getCompositionItemPointCount = (
  item: AsyraDesignAiCompositionItem
): number =>
  item.paths
    ? item.paths.reduce((count, path) => count + path.points.length, 0)
    : (item.points?.length ?? 0)

interface ProgressiveCompositionSliceRange {
  readonly end: number
  readonly start: number
}

const getProgressiveCompositionSliceRanges = (
  items: readonly AsyraDesignAiCompositionItem[]
): readonly ProgressiveCompositionSliceRange[] => {
  const ranges: ProgressiveCompositionSliceRange[] = []
  let start = 0
  let pointBudget = ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET
  while (start < items.length) {
    let pointCount = 0
    let end = start
    while (end < items.length) {
      const itemPointCount = getCompositionItemPointCount(items[end])
      if (end > start && pointCount + itemPointCount > pointBudget) {
        break
      }
      pointCount += itemPointCount
      end += 1
    }
    ranges.push(Object.freeze({ end, start }))
    start = end
    pointBudget = Math.min(
      ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_MAX_POINT_BUDGET,
      pointBudget * 2
    )
  }
  return Object.freeze(ranges)
}

const createCompositionActions = (
  apis: AsyraDesignAiActionApis,
  mutationOptions: EVENT_OPTIONS,
  deliveryMode: AsyraDesignAiDeliveryMode,
  progressiveYield: (() => Promise<void>) | null,
  stageProgressiveDelivery: (
    stage: AsyraDesignAiProgressiveDeliveryStage
  ) => Promise<void> | void
): readonly AiActionDefinition[] => {
  const compositionMutationOptions = createAiMutationOptions('atomic')
  const insert: AiActionDefinition<InsertVectorCompositionArgs> = Object.freeze(
    {
      description:
        'Insert validated editable oval or vector elements as one grouped composition.',
      execute: async (
        args: InsertVectorCompositionArgs,
        context: AiExecutionContext
      ) => {
        assertNotAborted(context)
        const { accepted, groupBounds, skipped } = measureBrowserDragPhase(
          'ai-app:prepare-composition',
          () => {
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
            return {
              accepted,
              groupBounds: deriveGroupBounds(
                accepted.map((item) => item.bounds)
              ),
              skipped
            }
          }
        )
        if (!hasAsyraDesignAiCompositionMinimumItemCount(accepted.length)) {
          throw new AsyraDesignAiCompositionError(
            'AI composition cannot preserve grouping after item validation.'
          )
        }
        const progressiveRanges =
          deliveryMode === 'progressive'
            ? measureBrowserDragPhase('ai-app:prepare-composition-slices', () =>
                getProgressiveCompositionSliceRanges(accepted)
              )
            : Object.freeze([])

        const appliedElementIds: string[] = []
        const roleToElementIds: Record<string, readonly string[]> = {}
        const pupils: string[] = []
        const whiskers: string[] = []
        const groupId = measureBrowserDragPhase(
          'ai-app:create-composition-group',
          () =>
            apis.createCompositionGroup(groupBounds, compositionMutationOptions)
        )
        if (!groupId) {
          throw new AsyraDesignAiCompositionError(
            'AI composition grouping failed.'
          )
        }
        const parent = Object.freeze({
          id: groupId,
          workspaceOrigin: Object.freeze({
            x: groupBounds.x,
            y: groupBounds.y
          })
        })
        assertNotAborted(context)
        const canonicalResult = measureBrowserDragPhase(
          'ai-app:create-composition-batch',
          () =>
            apis.createCompositionElements(
              accepted,
              parent,
              compositionMutationOptions
            )
        )
        if (!canonicalResult) {
          throw new AsyraDesignAiCompositionError(
            'AI composition canonical batch failed.'
          )
        }
        const createdElementIds = canonicalResult.orderedElementIds
        if (createdElementIds.length !== accepted.length) {
          throw new AsyraDesignAiCompositionError(
            'AI composition creation did not preserve the validated item count.'
          )
        }
        measureBrowserDragPhase('ai-app:record-created-elements', () => {
          for (let index = 0; index < accepted.length; index += 1) {
            assertNotAborted(context)
            const item = accepted[index]
            const elementId = createdElementIds[index]
            if (!elementId) {
              throw new AsyraDesignAiCompositionError(
                `AI composition creation failed for role "${item.role}".`
              )
            }
            appliedElementIds.push(elementId)
            roleToElementIds[item.role] = Object.freeze([elementId])
            if (item.role.includes('pupil')) {
              pupils.push(elementId)
            }
            if (item.role.includes('whisker')) {
              whiskers.push(elementId)
            }
          }
        })

        if (deliveryMode === 'progressive') {
          if (!progressiveYield) {
            throw new AsyraDesignAiCompositionError(
              'AI composition progressive delivery is unavailable.'
            )
          }
          const slices = Object.freeze(
            progressiveRanges.map(({ end, start }, index) =>
              Object.freeze({
                orderedIds: Object.freeze([
                  ...(index === 0 ? [groupId] : []),
                  ...createdElementIds.slice(start, end)
                ])
              })
            )
          )
          await stageProgressiveDelivery(
            Object.freeze({
              assertNotAborted: () => assertNotAborted(context),
              deliveryHandle: canonicalResult.deliveryHandle,
              signal: context.signal,
              slices,
              yieldToHost: progressiveYield
            })
          )
        }

        assertNotAborted(context)
        if (pupils.length > 0) {
          roleToElementIds.pupils = Object.freeze(pupils)
        }
        if (whiskers.length > 0) {
          roleToElementIds.whiskers = Object.freeze(whiskers)
        }
        return Object.freeze({
          action: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
          appliedElementIds: Object.freeze(appliedElementIds),
          compositionId: groupId,
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
        'Apply bounded geometry, fill-color, or stroke-color updates to existing context-exposed composition elements.',
      execute: async (
        args: UpdateCompositionElementsArgs,
        context: AiExecutionContext
      ) => {
        const prepared: {
          readonly elementId: string
          readonly fillColor?: string
          readonly geometry?: AsyraDesignAiCompositionBounds
          readonly strokeColor?: string
          readonly targetType: string
          readonly vectorScale?: UpdateCompositionGeometry
        }[] = []
        const skipped: { elementId: string; reason: string }[] = []
        const seen = new Set<string>()
        measureBrowserDragPhase('ai-app:prepare-update-operations', () => {
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
              if (targetType === 'vector') {
                prepared.push({
                  elementId: updateItem.elementId,
                  targetType,
                  vectorScale: updateItem.geometry
                })
                continue
              }
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
            const updatesFill = 'fillColor' in updateItem.style
            const currentColor = updatesFill
              ? apis.getElementFillColor(updateItem.elementId)
              : apis.getElementStrokeColor(updateItem.elementId)
            if (currentColor === null) {
              skipped.push(
                Object.freeze({
                  elementId: updateItem.elementId,
                  reason: updatesFill ? 'missing-fill' : 'missing-stroke'
                })
              )
              continue
            }
            const nextColor = updatesFill
              ? updateItem.style.fillColor
              : updateItem.style.strokeColor
            if (currentColor === nextColor) {
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
              ...(updatesFill
                ? { fillColor: nextColor }
                : { strokeColor: nextColor }),
              targetType
            })
          }
        })

        const appliedElementIds: string[] = []
        let operationIndex = 0
        while (operationIndex < prepared.length) {
          assertNotAborted(context)
          const operation = prepared[operationIndex]
          const geometry = operation.geometry
          if (geometry) {
            operationIndex += 1
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
            measureBrowserDragPhase('ai-app:apply-update-batch', () => {
              apis.changeElementGeometry(
                operation.elementId,
                geometry,
                mutationOptions
              )
            })
            appliedElementIds.push(operation.elementId)
            if (progressiveYield) {
              await measureBrowserDragAsyncPhase(
                'ai-app:progressive-host-yield',
                progressiveYield
              )
            }
            continue
          }
          const vectorScale = operation.vectorScale
          if (vectorScale) {
            operationIndex += 1
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
            const applied = measureBrowserDragPhase(
              'ai-app:apply-update-batch',
              () =>
                apis.scaleVectorElementGeometry(
                  operation.elementId,
                  vectorScale,
                  mutationOptions
                )
            )
            if (applied) {
              appliedElementIds.push(operation.elementId)
              if (progressiveYield) {
                await measureBrowserDragAsyncPhase(
                  'ai-app:progressive-host-yield',
                  progressiveYield
                )
              }
            } else {
              skipped.push(
                Object.freeze({
                  elementId: operation.elementId,
                  reason: 'unsupported-target'
                })
              )
            }
            continue
          }

          const isFillBatch = operation.fillColor !== undefined
          if (!isFillBatch && operation.strokeColor === undefined) {
            throw new AsyraDesignAiCompositionError(
              'AI composition update preparation produced an invalid operation.'
            )
          }
          const { batchOperations, nextOperationIndex } =
            measureBrowserDragPhase('ai-app:prepare-update-batch', () => {
              const batchOperations: (typeof prepared)[number][] = []
              let nextOperationIndex = operationIndex
              while (
                nextOperationIndex < prepared.length &&
                batchOperations.length <
                  ASYRA_DESIGN_AI_TRANSIENT_CREATE_CHUNK_SIZE
              ) {
                assertNotAborted(context)
                const candidate = prepared[nextOperationIndex]
                const candidateIsFill = candidate.fillColor !== undefined
                const candidateIsStroke = candidate.strokeColor !== undefined
                if (
                  candidate.geometry ||
                  candidate.vectorScale ||
                  (!candidateIsFill && !candidateIsStroke) ||
                  candidateIsFill !== isFillBatch
                ) {
                  break
                }
                nextOperationIndex += 1
                if (
                  apis.getElementType(candidate.elementId) !==
                  candidate.targetType
                ) {
                  skipped.push(
                    Object.freeze({
                      elementId: candidate.elementId,
                      reason: 'missing-target'
                    })
                  )
                  continue
                }
                batchOperations.push(candidate)
              }
              return {
                batchOperations,
                nextOperationIndex
              }
            })
          operationIndex = nextOperationIndex
          if (batchOperations.length === 0) {
            continue
          }
          const colorUpdates = batchOperations.map((candidate) => {
            const color = isFillBatch
              ? candidate.fillColor
              : candidate.strokeColor
            if (color === undefined) {
              throw new AsyraDesignAiCompositionError(
                'AI composition update preparation produced an invalid style operation.'
              )
            }
            return {
              color,
              elementId: candidate.elementId
            }
          })
          const batchResults = measureBrowserDragPhase(
            'ai-app:apply-update-batch',
            () =>
              isFillBatch
                ? apis.updateElementFillColors(colorUpdates, mutationOptions)
                : apis.updateElementStrokeColors(colorUpdates, mutationOptions)
          )
          if (batchResults.length !== batchOperations.length) {
            throw new AsyraDesignAiCompositionError(
              'AI composition style batch did not preserve the requested item count.'
            )
          }
          let appliedBatchCount = 0
          batchResults.forEach((applied, index) => {
            const batchOperation = batchOperations[index]
            if (applied) {
              appliedElementIds.push(batchOperation.elementId)
              appliedBatchCount += 1
              return
            }
            skipped.push(
              Object.freeze({
                elementId: batchOperation.elementId,
                reason: 'no-change'
              })
            )
          })
          if (appliedBatchCount > 0 && progressiveYield) {
            await measureBrowserDragAsyncPhase(
              'ai-app:progressive-host-yield',
              progressiveYield
            )
          }
        }
        assertNotAborted(context)
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
    execute: async (
      args: RemoveAiCompositionArgs,
      context: AiExecutionContext
    ) => {
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
      const result = apis.removeSubtree(args.compositionId, mutationOptions)
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
  apis: AsyraDesignAiActionApis = defaultApis,
  options: CreateAsyraDesignAiActionsOptions = {}
): readonly AiActionDefinition[] => {
  const deliveryMode = options.deliveryMode ?? 'atomic'
  const mutationOptions = createAiMutationOptions(deliveryMode)
  const progressiveYield =
    deliveryMode === 'progressive' ? (options.yieldToHost ?? yieldToHost) : null
  const stageProgressiveDelivery =
    options.stageProgressiveDelivery ??
    (async (stage: AsyraDesignAiProgressiveDeliveryStage): Promise<void> => {
      const coordinator = createAsyraDesignAiProgressiveDeliveryCoordinator()
      coordinator.stage(stage)
      await coordinator.flush()
    })
  const drawingDetailChoice: AiActionDefinition<RequestDrawingDetailChoiceArgs> =
    Object.freeze({
      name: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      description:
        'Request an App-owned choice between supported drawing detail levels without mutating the document.',
      schema: Object.freeze({
        providerSchema: Object.freeze({
          additionalProperties: false,
          properties: Object.freeze({}),
          type: 'object'
        }),
        parse: parseDrawingDetailChoice
      }),
      execute: async (
        _args: RequestDrawingDetailChoiceArgs,
        context: AiExecutionContext
      ) => {
        assertNotAborted(context)
        return Object.freeze({
          action: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
          clarification: Object.freeze({
            kind: 'drawing-detail',
            optionIds: Object.freeze([
              AsyraDesignAiDrawingDetailOptionIds.BALANCED,
              AsyraDesignAiDrawingDetailOptionIds.MAXIMUM
            ])
          }),
          status: 'no-change'
        })
      }
    })
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
          mutationOptions
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
      apis.selectElements([...args.elementIds], mutationOptions)
      return Object.freeze({
        action: AsyraDesignAiActionNames.SELECT_ELEMENTS,
        selectedCount: args.elementIds.length
      })
    }
  })

  return Object.freeze([
    drawingDetailChoice,
    ...createCompositionActions(
      apis,
      mutationOptions,
      deliveryMode,
      progressiveYield,
      stageProgressiveDelivery
    ),
    visibility,
    selection
  ])
}
