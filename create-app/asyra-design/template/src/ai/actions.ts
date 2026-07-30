import type {
  AiActionDefinition,
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

export { AsyraDesignAiActionNames } from '../constants'

export const ASYRA_DESIGN_AI_SELECTION_LIMIT = 100
export const ASYRA_DESIGN_AI_WORKSPACE_LIMIT = 2048
export const ASYRA_DESIGN_AI_TRANSIENT_CREATE_CHUNK_SIZE = 256
export const ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET = 2048

export type AsyraDesignAiDeliveryMode = 'atomic' | 'progressive'

export interface CreateAsyraDesignAiActionsOptions {
  readonly deliveryMode?: AsyraDesignAiDeliveryMode
  readonly yieldToHost?: () => Promise<void>
}

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
  readonly groupBounds: AsyraDesignAiCompositionBounds
  readonly itemPointCounts: readonly number[]
  readonly items: readonly AsyraDesignAiCompositionItem[]
  readonly parent: 'workspace'
  readonly skipped: readonly {
    readonly reason: 'duplicate-role'
    readonly role: string
  }[]
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
  ): readonly (string | null)[]
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
): readonly (string | null)[] =>
  elementApis.createElements(
    items.map((item) => createCompositionElementOptions(item, parent)),
    options
  )

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
  updateElementStrokeColor: (elementId, color, options) =>
    strokeApis.updatePrimaryStrokeColor(elementId, color, options)
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

const getProgressiveCompositionBatchEnd = (
  itemPointCounts: readonly number[],
  start: number
): number => {
  let batchPointCount = 0
  let end = start
  while (
    end < itemPointCounts.length &&
    end - start < ASYRA_DESIGN_AI_TRANSIENT_CREATE_CHUNK_SIZE
  ) {
    const itemPointCount = itemPointCounts[end]
    if (
      end > start &&
      batchPointCount + itemPointCount >
        ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET
    ) {
      break
    }
    batchPointCount += itemPointCount
    end += 1
  }
  return end
}

const createCompositionActions = (
  apis: AsyraDesignAiActionApis,
  mutationOptions: EVENT_OPTIONS,
  deliveryMode: AsyraDesignAiDeliveryMode,
  progressiveYield: (() => Promise<void>) | null
): readonly AiActionDefinition[] => {
  const insert: AiActionDefinition<InsertVectorCompositionArgs> = Object.freeze(
    {
      description:
        'Insert server-prepared editable oval or vector elements as one grouped composition.',
      execute: async (
        args: InsertVectorCompositionArgs,
        context: AiExecutionContext
      ) => {
        const { groupBounds, itemPointCounts, items: accepted, skipped } = args

        const appliedElementIds: string[] = []
        const roleToElementIds: Record<string, readonly string[]> = {}
        const pupils: string[] = []
        const whiskers: string[] = []
        const groupId = apis.createCompositionGroup(
          groupBounds,
          mutationOptions
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
        let offset = 0
        while (offset < accepted.length) {
          assertNotAborted(context)
          const batchEnd =
            deliveryMode === 'progressive'
              ? getProgressiveCompositionBatchEnd(itemPointCounts, offset)
              : Math.min(
                  offset + ASYRA_DESIGN_AI_TRANSIENT_CREATE_CHUNK_SIZE,
                  accepted.length
                )
          const batch = accepted.slice(offset, batchEnd)
          const createdElementIds = apis.createCompositionElements(
            batch,
            parent,
            mutationOptions
          )
          for (let index = 0; index < batch.length; index += 1) {
            assertNotAborted(context)
            const item = batch[index]
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
          offset = batchEnd
          await progressiveYield?.()
        }

        if (appliedElementIds.length !== accepted.length) {
          throw new AsyraDesignAiCompositionError(
            'AI composition creation did not preserve the server-prepared item count.'
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
      inputSchema: Object.freeze({
        additionalProperties: false,
        properties: Object.freeze({
          compositionRole: Object.freeze({ type: 'string' }),
          groupBounds: Object.freeze({ type: 'object' }),
          itemPointCounts: Object.freeze({
            minItems: 1,
            type: 'array'
          }),
          items: Object.freeze({
            minItems: 1,
            type: 'array'
          }),
          parent: Object.freeze({
            const: 'workspace',
            type: 'string'
          }),
          skipped: Object.freeze({ type: 'array' })
        }),
        required: Object.freeze([
          'compositionRole',
          'groupBounds',
          'itemPointCounts',
          'items',
          'parent',
          'skipped'
        ]),
        type: 'object'
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
              mutationOptions
            )
            appliedElementIds.push(operation.elementId)
            await progressiveYield?.()
            continue
          }
          if (operation.vectorScale) {
            if (
              apis.scaleVectorElementGeometry(
                operation.elementId,
                operation.vectorScale,
                mutationOptions
              )
            ) {
              appliedElementIds.push(operation.elementId)
              await progressiveYield?.()
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
          if (
            operation.fillColor !== undefined &&
            apis.updateElementFillColor(
              operation.elementId,
              operation.fillColor,
              mutationOptions
            )
          ) {
            appliedElementIds.push(operation.elementId)
            await progressiveYield?.()
          } else if (
            operation.strokeColor !== undefined &&
            apis.updateElementStrokeColor(
              operation.elementId,
              operation.strokeColor,
              mutationOptions
            )
          ) {
            appliedElementIds.push(operation.elementId)
            await progressiveYield?.()
          } else {
            skipped.push(
              Object.freeze({
                elementId: operation.elementId,
                reason: 'no-change'
              })
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
      inputSchema: Object.freeze({
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
    inputSchema: Object.freeze({
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
  const drawingDetailChoice: AiActionDefinition<RequestDrawingDetailChoiceArgs> =
    Object.freeze({
      name: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      description:
        'Request an App-owned choice between supported drawing detail levels without mutating the document.',
      inputSchema: Object.freeze({
        additionalProperties: false,
        properties: Object.freeze({}),
        type: 'object'
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
      inputSchema: Object.freeze({
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
    inputSchema: Object.freeze({
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
      progressiveYield
    ),
    visibility,
    selection
  ])
}
