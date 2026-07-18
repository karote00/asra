import type {
  RenderEngineCommand,
  RenderEngineDrawOperation,
  RenderEngineObjectType
} from '@asyra/render-engine'

let canvasPipelineDebuggerOwnedObjects: WeakSet<object> | undefined

export const markCanvasPipelineDebuggerOwned = <T extends object>(
  value: T
): T => {
  canvasPipelineDebuggerOwnedObjects ??= new WeakSet<object>()
  canvasPipelineDebuggerOwnedObjects.add(value)
  return value
}

export const isCanvasPipelineDebuggerOwned = (
  value: object | null | undefined
): boolean =>
  value !== null &&
  value !== undefined &&
  (canvasPipelineDebuggerOwnedObjects?.has(value) ?? false)

export const CanvasPipelineEvidenceKinds = {
  ELEMENT_INPUT: 'element-input',
  VIEWPORT_INPUT: 'viewport-input',
  LAYER_EVALUATION: 'layer-evaluation',
  ENGINE_HANDOFF: 'engine-handoff',
  FRAME: 'frame'
} as const

export interface CanvasPipelineDetachedObject {
  readonly [key: string]: CanvasPipelineDetachedValue
}

export type CanvasPipelineDetachedValue =
  | null
  | boolean
  | number
  | string
  | readonly CanvasPipelineDetachedValue[]
  | CanvasPipelineDetachedObject

export interface CanvasPipelineCommandContext {
  elementId: string | null
  objectType?: RenderEngineObjectType
  renderRole?: 'viewport'
  relatedElementId: string | null
  relatedObjectType?: RenderEngineObjectType
  projection?: CanvasPipelineProjectionSnapshot
}

export interface CanvasPipelineMatrixSnapshot {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

export interface CanvasPipelineBoundsSnapshot {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasPipelineProjectionSnapshot {
  localBounds: CanvasPipelineBoundsSnapshot
  worldTransform: CanvasPipelineMatrixSnapshot
  viewportTransform: CanvasPipelineMatrixSnapshot
}

export interface CanvasPipelineCommandSnapshot {
  type: RenderEngineCommand['type']
  elementId?: string
  objectType?: RenderEngineObjectType
  renderRole?: 'viewport'
  relatedElementId?: string
  relatedObjectType?: RenderEngineObjectType
  requestId?: string
  data?: CanvasPipelineDetachedValue
  projection?: CanvasPipelineProjectionSnapshot
}

interface CanvasPipelineEvidenceBase {
  kind: (typeof CanvasPipelineEvidenceKinds)[keyof typeof CanvasPipelineEvidenceKinds]
  frameId: number
}

export interface CanvasPipelineElementInputEvidence
  extends CanvasPipelineEvidenceBase {
  kind: typeof CanvasPipelineEvidenceKinds.ELEMENT_INPUT
  operation: 'add' | 'update' | 'remove'
  elementId: string
  data: CanvasPipelineDetachedValue
}

export interface CanvasPipelineViewportInputEvidence
  extends CanvasPipelineEvidenceBase {
  kind: typeof CanvasPipelineEvidenceKinds.VIEWPORT_INPUT
  operation: 'pan' | 'zoom' | 'zoom-center' | 'zoom-fit' | 'resize'
  data: CanvasPipelineDetachedValue
}

export interface CanvasPipelineLayerEvaluationEvidence
  extends CanvasPipelineEvidenceBase {
  kind: typeof CanvasPipelineEvidenceKinds.LAYER_EVALUATION
  layerName: string
  zIndex: number
  outcome: 'bypassed' | 'unchanged' | 'changed'
}

export interface CanvasPipelineEngineHandoffEvidence
  extends CanvasPipelineEvidenceBase {
  kind: typeof CanvasPipelineEvidenceKinds.ENGINE_HANDOFF
  command: CanvasPipelineCommandSnapshot
}

export interface CanvasPipelineFrameEvidence
  extends CanvasPipelineEvidenceBase {
  kind: typeof CanvasPipelineEvidenceKinds.FRAME
  phase: 'start' | 'complete'
  outcome?: 'rendered' | 'skipped' | 'failed'
  handoffCount: number
}

export type CanvasPipelineEvidence =
  | CanvasPipelineElementInputEvidence
  | CanvasPipelineViewportInputEvidence
  | CanvasPipelineLayerEvaluationEvidence
  | CanvasPipelineEngineHandoffEvidence
  | CanvasPipelineFrameEvidence

export interface CanvasPipelineEvidenceSubscription {
  onEvidence: (evidence: CanvasPipelineEvidence) => void
  onError?: (error: Error) => void
}

const subscriptionsByOwner = new WeakMap<
  object,
  Set<CanvasPipelineEvidenceSubscription>
>()

const freezeDeep = <T>(value: T): T => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }
  Object.freeze(value)
  Object.values(value).forEach(freezeDeep)
  return value
}

const detachValue = (
  value: unknown,
  ancestors: WeakSet<object>
): CanvasPipelineDetachedValue => {
  if (value === null) {
    return null
  }
  switch (typeof value) {
    case 'boolean':
    case 'number':
    case 'string':
      return value
    case 'undefined':
      return { type: 'undefined' }
    case 'bigint':
      return { type: 'bigint', value: value.toString() }
    case 'symbol':
      return { type: 'symbol', description: value.description ?? '' }
    case 'function':
      return { type: 'function', name: value.name }
  }

  if (ancestors.has(value)) {
    return { type: 'circular' }
  }
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return value.map((item) => detachValue(item, ancestors))
    }
    const detached: Record<string, CanvasPipelineDetachedValue> = {}
    Object.keys(value)
      .sort()
      .forEach((key) => {
        detached[key] = detachValue(
          (value as Record<string, unknown>)[key],
          ancestors
        )
      })
    return detached
  } finally {
    ancestors.delete(value)
  }
}

export const snapshotCanvasPipelineValue = (
  value: unknown
): CanvasPipelineDetachedValue => freezeDeep(detachValue(value, new WeakSet()))

const sanitizeDrawOperation = (
  operation: RenderEngineDrawOperation
): CanvasPipelineDetachedValue => {
  if (operation.type !== 'fill' && operation.type !== 'stroke') {
    return snapshotCanvasPipelineValue(operation)
  }
  const paint = operation.paint.resource
    ? { ...operation.paint, resource: 'opaque-resource' }
    : operation.paint
  return snapshotCanvasPipelineValue({ ...operation, paint })
}

export const snapshotCanvasPipelineCommand = (
  command: RenderEngineCommand,
  context: CanvasPipelineCommandContext = {
    elementId: null,
    relatedElementId: null
  }
): CanvasPipelineCommandSnapshot => {
  const base = {
    type: command.type,
    ...(context.elementId ? { elementId: context.elementId } : {}),
    ...(context.objectType ? { objectType: context.objectType } : {}),
    ...(context.renderRole ? { renderRole: context.renderRole } : {}),
    ...(context.relatedElementId
      ? { relatedElementId: context.relatedElementId }
      : {}),
    ...(context.relatedObjectType
      ? { relatedObjectType: context.relatedObjectType }
      : {}),
    ...(context.projection ? { projection: context.projection } : {})
  }
  switch (command.type) {
    case 'create-object':
      return freezeDeep({
        ...base,
        requestId: command.requestId,
        objectType: command.objectType,
        data: snapshotCanvasPipelineValue(command.properties ?? {})
      })
    case 'update-object':
      return freezeDeep({
        ...base,
        data: snapshotCanvasPipelineValue(command.properties)
      })
    case 'draw':
      return freezeDeep({
        ...base,
        data: command.operations.map(sanitizeDrawOperation)
      })
    case 'create-resource':
      return freezeDeep({
        ...base,
        requestId: command.requestId,
        data: snapshotCanvasPipelineValue(command.descriptor)
      })
    case 'resize':
      return freezeDeep({
        ...base,
        data: snapshotCanvasPipelineValue({
          width: command.width,
          height: command.height
        })
      })
    case 'set-viewport':
      return freezeDeep({
        ...base,
        data: snapshotCanvasPipelineValue({
          position: command.position,
          scale: command.scale
        })
      })
    case 'set-child-index':
      return freezeDeep({
        ...base,
        data: snapshotCanvasPipelineValue({ index: command.index })
      })
    case 'destroy-object':
    case 'append-child':
    case 'remove-child':
    case 'destroy-resource':
    case 'flush':
      return freezeDeep(base)
  }
}

export const hasCanvasPipelineEvidenceSubscribers = (owner: object): boolean =>
  (subscriptionsByOwner.get(owner)?.size ?? 0) > 0

export const subscribeToCanvasPipelineEvidence = (
  owner: object,
  subscription: CanvasPipelineEvidenceSubscription
): (() => void) => {
  const subscriptions = subscriptionsByOwner.get(owner) ?? new Set()
  subscriptions.add(subscription)
  subscriptionsByOwner.set(owner, subscriptions)
  let active = true
  return () => {
    if (!active) {
      return
    }
    active = false
    subscriptions.delete(subscription)
    if (subscriptions.size === 0) {
      subscriptionsByOwner.delete(owner)
    }
  }
}

export const publishCanvasPipelineEvidence = (
  owner: object,
  createEvidence: () => CanvasPipelineEvidence
): void => {
  const subscriptions = subscriptionsByOwner.get(owner)
  if (!subscriptions || subscriptions.size === 0) {
    return
  }
  let frozenEvidence: CanvasPipelineEvidence
  try {
    frozenEvidence = freezeDeep(createEvidence())
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause))
    ;[...subscriptions].forEach((subscription) => {
      subscriptions.delete(subscription)
      try {
        subscription.onError?.(error)
      } catch {
        // Diagnostic failure must never interrupt canonical rendering.
      }
    })
    subscriptionsByOwner.delete(owner)
    return
  }
  ;[...subscriptions].forEach((subscription) => {
    try {
      subscription.onEvidence(frozenEvidence)
    } catch (cause) {
      subscriptions.delete(subscription)
      const error = cause instanceof Error ? cause : new Error(String(cause))
      try {
        subscription.onError?.(error)
      } catch {
        // Diagnostic failure must never interrupt canonical rendering.
      }
    }
  })
  if (subscriptions.size === 0) {
    subscriptionsByOwner.delete(owner)
  }
}
