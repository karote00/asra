import type { AiActionBatch } from './provider.js'
import type {
  AiActionDefinition,
  AiActionRegistry,
  AiJsonValue
} from './types.js'

export type AiActionBatchContractErrorCode = 'AI_ACTION_BATCH_MALFORMED'

export class AiActionBatchContractError extends Error {
  readonly code: AiActionBatchContractErrorCode = 'AI_ACTION_BATCH_MALFORMED'
  readonly retryable = true
  readonly stage = 'provider' as const

  constructor() {
    super('AI provider returned a malformed server-prepared action batch.')
    this.name = 'AiActionBatchContractError'
  }
}

const malformedActionBatch = (): never => {
  throw new AiActionBatchContractError()
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const readDataProperty = (
  value: Record<string, unknown>,
  key: string
): { readonly present: boolean; readonly value: unknown } => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor?.enumerable || !('value' in descriptor)) {
    return {
      present: false,
      value: undefined
    }
  }

  return {
    present: true,
    value: descriptor.value
  }
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

interface RawResolvedAction {
  readonly arguments: unknown
  readonly definition: AiActionDefinition
  readonly id: string
  readonly name: string
  readonly summary: unknown
}

interface RawActionBatchShell {
  readonly actions: readonly RawResolvedAction[]
  readonly batchId: string
  readonly explanation?: string
}

export type AiActionBatchResolutionErrorCode =
  | 'AI_ACTION_BATCH_DUPLICATE_ACTION_ID'
  | 'AI_ACTION_BATCH_EMPTY'
  | 'AI_ACTION_BATCH_UNKNOWN_ACTION'

export class AiActionBatchResolutionError extends Error {
  readonly code: AiActionBatchResolutionErrorCode
  readonly stage = 'resolution' as const

  constructor(code: AiActionBatchResolutionErrorCode, message: string) {
    super(message)
    this.name = 'AiActionBatchResolutionError'
    this.code = code
  }
}

const resolutionError = (
  code: AiActionBatchResolutionErrorCode,
  message: string
): never => {
  throw new AiActionBatchResolutionError(code, message)
}

const readRawAction = (
  value: unknown
): Omit<RawResolvedAction, 'definition'> => {
  if (!isPlainObject(value)) {
    return malformedActionBatch()
  }

  const id = readDataProperty(value, 'id')
  const name = readDataProperty(value, 'name')
  const argumentsValue = readDataProperty(value, 'arguments')
  const summary = readDataProperty(value, 'summary')

  if (
    !id.present ||
    !nonEmptyString(id.value) ||
    !name.present ||
    !nonEmptyString(name.value) ||
    !argumentsValue.present ||
    !summary.present
  ) {
    return malformedActionBatch()
  }

  return {
    arguments: argumentsValue.value,
    id: id.value,
    name: name.value,
    summary: summary.value
  }
}

const preflightActionBatchShell = (
  value: unknown,
  registry: AiActionRegistry,
  signal: AbortSignal
): RawActionBatchShell => {
  if (signal.aborted) {
    throw signal.reason
  }
  if (!isPlainObject(value)) {
    return malformedActionBatch()
  }

  const batchId = readDataProperty(value, 'batchId')
  const explanation = readDataProperty(value, 'explanation')
  const actions = readDataProperty(value, 'actions')

  if (
    !batchId.present ||
    !nonEmptyString(batchId.value) ||
    !actions.present ||
    !Array.isArray(actions.value) ||
    (explanation.present && typeof explanation.value !== 'string')
  ) {
    return malformedActionBatch()
  }

  if (actions.value.length === 0) {
    return resolutionError(
      'AI_ACTION_BATCH_EMPTY',
      'AI action batch must contain at least one action.'
    )
  }

  const actionIds = new Set<string>()
  const rawActions: RawResolvedAction[] = []
  for (let index = 0; index < actions.value.length; index += 1) {
    if (signal.aborted) {
      throw signal.reason
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      actions.value,
      String(index)
    )
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return malformedActionBatch()
    }
    const action = readRawAction(descriptor.value)
    if (actionIds.has(action.id)) {
      return resolutionError(
        'AI_ACTION_BATCH_DUPLICATE_ACTION_ID',
        'AI action batch contains a duplicate action id.'
      )
    }
    actionIds.add(action.id)
    const definition = registry.get(action.name)
    if (!definition) {
      return resolutionError(
        'AI_ACTION_BATCH_UNKNOWN_ACTION',
        'AI action batch references an unknown action.'
      )
    }
    rawActions.push({
      ...action,
      definition
    })
  }

  const batch: RawActionBatchShell = {
    actions: rawActions,
    batchId: batchId.value,
    ...(typeof explanation.value === 'string'
      ? {
          explanation: explanation.value
        }
      : {})
  }
  return batch
}

export interface ResolvedAiAction {
  readonly id: string
  readonly name: string
  readonly arguments: unknown
  readonly summary: AiJsonValue
  readonly execute: AiActionDefinition['execute']
}

export interface ResolvedAiActionBatch {
  readonly batchId: string
  readonly explanation?: string
  readonly actions: readonly ResolvedAiAction[]
}

export const resolveAiActionBatchWithRegistry = (
  batch: AiActionBatch,
  registry: AiActionRegistry,
  options: { readonly signal: AbortSignal }
): ResolvedAiActionBatch => {
  const shell = preflightActionBatchShell(batch, registry, options.signal)
  const actions = shell.actions.map((action) =>
    Object.freeze({
      arguments: action.arguments,
      execute: action.definition.execute,
      id: action.id,
      name: action.name,
      summary: action.summary as AiJsonValue
    })
  )
  const resolved: ResolvedAiActionBatch = {
    actions: Object.freeze(actions),
    batchId: shell.batchId,
    ...(shell.explanation === undefined
      ? {}
      : {
          explanation: shell.explanation
        })
  }

  return Object.freeze(resolved)
}
