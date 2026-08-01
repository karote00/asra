import type {
  AiActionDefinition,
  AiExecutionContext
} from '@asyra/ai-agent-runtime'
import {
  emitDiagnosticCounter,
  measureBrowserDragAsyncPhase,
  measureBrowserDragPhase,
  type EVENT_OPTIONS
} from '@asyra/utils'
import {
  elementApis,
  fillApis,
  hierarchyApis,
  selectionApis,
  strokeApis,
  systemContextApis,
  type PreparedElementDescriptor
} from '../common-apis'
import type { AiDrawingProgressState } from '../common-apis/system-context'
import {
  AsyraDesignAiActionNames,
  AsyraDesignAiDrawingDetailOptionIds
} from '../constants'
import type { PreparedDrawingArtifact } from './prepared-drawing-artifact'

export { AsyraDesignAiActionNames } from '../constants'

export const ASYRA_DESIGN_AI_SELECTION_LIMIT = 100
export const ASYRA_DESIGN_AI_WORKSPACE_LIMIT = 2048
export const ASYRA_DESIGN_AI_SCALE_MIN = 0.5
export const ASYRA_DESIGN_AI_SCALE_MAX = 2
export const ASYRA_DESIGN_AI_TRANSIENT_CREATE_CHUNK_SIZE = 256

export interface CreateAsyraDesignAiActionsOptions {
  readonly waitForPaint?: () => Promise<void>
  readonly yieldToHost?: () => Promise<void>
}

const createAiMutationOptions = (): EVENT_OPTIONS =>
  Object.freeze({
    sharedDelivery: 'immediate',
    undoable: true
  })

interface CooperativeTaskScheduler {
  yield?: () => Promise<void>
}

const yieldToHost = (): Promise<void> => {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: CooperativeTaskScheduler
    }
  ).scheduler
  if (typeof scheduler?.yield === 'function') {
    return scheduler.yield()
  }

  if (typeof globalThis.MessageChannel === 'function') {
    return new Promise((resolve) => {
      const channel = new globalThis.MessageChannel()
      channel.port1.onmessage = () => {
        channel.port1.close()
        channel.port2.close()
        resolve()
      }
      channel.port2.postMessage(undefined)
    })
  }

  if (typeof globalThis.requestAnimationFrame === 'function') {
    return new Promise((resolve) => {
      globalThis.requestAnimationFrame(() => resolve())
    })
  }

  return Promise.reject(
    new Error('This environment does not support cooperative host scheduling.')
  )
}

const waitForBrowserPaint = (): Promise<void> => {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    return yieldToHost()
  }

  return new Promise((resolve) => {
    globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(() => resolve())
    })
  })
}

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
  createCompositionElements(
    descriptors: readonly PreparedElementDescriptor[],
    parent: {
      readonly id: string
    },
    options?: EVENT_OPTIONS
  ): readonly string[] | null
  createCompositionGroup(
    descriptor: PreparedElementDescriptor,
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
  setDrawingProgress(progress: AiDrawingProgressState | null): void
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

const createCompositionElements = (
  descriptors: readonly PreparedElementDescriptor[],
  parent: {
    readonly id: string
  },
  options?: EVENT_OPTIONS
): readonly string[] | null =>
  elementApis.createElementsInParent(descriptors, parent.id, options)

const defaultApis: AsyraDesignAiActionApis = {
  changeElementGeometry: (elementId, geometry, options) =>
    elementApis.changeElementGeometry(elementId, geometry, options),
  createCompositionElements,
  createCompositionGroup: (descriptor, options) => {
    const workspaceId = hierarchyApis.getWorkspaceId()
    if (!workspaceId) {
      return null
    }
    return (
      elementApis.createElementsInParent(
        Object.freeze([descriptor]),
        workspaceId,
        options
      )?.[0] ?? null
    )
  },
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
  setDrawingProgress: (progress) =>
    systemContextApis.setAiDrawingProgress(progress),
  updateElementFillColor: (elementId, color, options) =>
    fillApis.updatePrimaryFillColor(elementId, color, options),
  updateElementFillColors: (updates, options) =>
    fillApis.updatePrimaryFillColors(updates, options),
  updateElementStrokeColor: (elementId, color, options) =>
    strokeApis.updatePrimaryStrokeColor(elementId, color, options),
  updateElementStrokeColors: (updates, options) =>
    strokeApis.updatePrimaryStrokeColors(updates, options)
}

const assertNotAborted = (context: { readonly signal: AbortSignal }): void => {
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

const createDrawingProgressState = (
  bounds: AsyraDesignAiCompositionBounds,
  totalElements: number,
  completedElements = 0
): AiDrawingProgressState =>
  Object.freeze({
    bounds: Object.freeze({ ...bounds }),
    completedElements,
    phase: completedElements === 0 ? 'preparing' : 'drawing',
    totalElements
  })

const createCompositionActions = (
  apis: AsyraDesignAiActionApis,
  mutationOptions: EVENT_OPTIONS,
  hostYield: () => Promise<void>,
  paintYield: () => Promise<void>
): readonly AiActionDefinition[] => {
  const insert: AiActionDefinition<PreparedDrawingArtifact> = Object.freeze({
    description:
      'Insert one prepared editable composition through ordered canonical descriptor slices.',
    execute: async (
      artifact: PreparedDrawingArtifact,
      context: AiExecutionContext
    ) => {
      assertNotAborted(context)
      const {
        elementCount,
        groupBounds,
        groupDescriptor,
        roleToElementIds,
        skipped,
        slices
      } = artifact
      const appliedElementIds: string[] = []
      let paintYieldCount = 0
      let progressActive = false
      try {
        apis.setDrawingProgress(
          createDrawingProgressState(groupBounds, elementCount)
        )
        progressActive = true
        await paintYield()
        emitDiagnosticCounter('ai-drawing:loading-frame-visible')
        assertNotAborted(context)

        const groupId = measureBrowserDragPhase(
          'ai-app:create-composition-group',
          () => apis.createCompositionGroup(groupDescriptor, mutationOptions)
        )
        if (!groupId || groupId !== groupDescriptor.id) {
          throw new AsyraDesignAiCompositionError(
            'AI composition grouping did not preserve its canonical id.'
          )
        }
        await paintYield()
        assertNotAborted(context)
        const parent = Object.freeze({ id: groupId })

        for (const slice of slices) {
          assertNotAborted(context)
          const createdElementIds = measureBrowserDragPhase(
            'ai-app:create-composition-batch',
            () =>
              apis.createCompositionElements(
                slice.descriptors,
                parent,
                mutationOptions
              )
          )
          if (
            !createdElementIds ||
            createdElementIds.length !== slice.descriptors.length ||
            createdElementIds.some(
              (elementId, index) => elementId !== slice.descriptors[index]?.id
            )
          ) {
            throw new AsyraDesignAiCompositionError(
              'AI composition batch did not preserve its ordered canonical ids.'
            )
          }
          appliedElementIds.push(...createdElementIds)
          apis.setDrawingProgress(
            createDrawingProgressState(
              groupBounds,
              elementCount,
              appliedElementIds.length
            )
          )
          await paintYield()
          paintYieldCount += 1
          emitDiagnosticCounter(
            'ai-drawing:visible-element-count',
            appliedElementIds.length
          )
          assertNotAborted(context)
        }
        emitDiagnosticCounter(
          'ai-drawing:cooperative-yield-count',
          paintYieldCount
        )

        return Object.freeze({
          action: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
          appliedElementIds: Object.freeze(appliedElementIds),
          compositionId: groupId,
          roleToElementIds,
          skipped,
          status: statusForMutation(appliedElementIds.length, skipped.length)
        })
      } finally {
        if (progressActive) {
          apis.setDrawingProgress(null)
        }
      }
    },
    name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
    inputSchema: Object.freeze({
      additionalProperties: false,
      properties: Object.freeze({
        artifactVersion: Object.freeze({ const: 1, type: 'number' }),
        compositionRole: Object.freeze({ type: 'string' }),
        elementCount: Object.freeze({ minimum: 1, type: 'number' }),
        groupBounds: Object.freeze({ type: 'object' }),
        groupDescriptor: Object.freeze({ type: 'object' }),
        parent: Object.freeze({
          const: 'workspace',
          type: 'string'
        }),
        pointCount: Object.freeze({ minimum: 0, type: 'number' }),
        roleToElementIds: Object.freeze({ type: 'object' }),
        skipped: Object.freeze({ type: 'array' }),
        slices: Object.freeze({
          minItems: 1,
          type: 'array'
        })
      }),
      required: Object.freeze([
        'artifactVersion',
        'compositionRole',
        'elementCount',
        'groupBounds',
        'groupDescriptor',
        'parent',
        'pointCount',
        'roleToElementIds',
        'skipped',
        'slices'
      ]),
      type: 'object'
    })
  })

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
            await measureBrowserDragAsyncPhase(
              'ai-app:progressive-host-yield',
              hostYield
            )
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
              await measureBrowserDragAsyncPhase(
                'ai-app:progressive-host-yield',
                hostYield
              )
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
          if (appliedBatchCount > 0) {
            await measureBrowserDragAsyncPhase(
              'ai-app:progressive-host-yield',
              hostYield
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
  const mutationOptions = createAiMutationOptions()
  const hostYield = options.yieldToHost ?? yieldToHost
  const paintYield =
    options.waitForPaint ?? options.yieldToHost ?? waitForBrowserPaint
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
    ...createCompositionActions(apis, mutationOptions, hostYield, paintYield),
    visibility,
    selection
  ])
}
