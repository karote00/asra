import type {
  AiJsonValue,
  AiRuntimeProgressObserver,
  AiRuntimeProgressUpdate
} from '@asyra/ai-agent-runtime'

export type AsyraDesignAiConversationOutcome =
  | 'cancelled'
  | 'failed'
  | 'no-change'
  | 'partial'
  | 'success'
  | 'unavailable'

export interface AsyraDesignAiTargetHints {
  readonly compositionId: string | null
  readonly roleToElementIds: Readonly<Record<string, readonly string[]>>
}

export interface AsyraDesignAiConversationFeatureRequest {
  readonly intent: string
  readonly metadata: AiJsonValue
  readonly progressObserver: AiRuntimeProgressObserver
}

export interface AsyraDesignAiConversationFeature {
  execute(request: AsyraDesignAiConversationFeatureRequest): Promise<unknown>
  cancel(reason?: unknown): boolean
}

export interface AsyraDesignAiActiveTurn {
  readonly conversationId: string
  readonly intent: string
  readonly progress: readonly AiRuntimeProgressUpdate[]
  readonly turnId: string
}

export interface AsyraDesignAiSettledTurn {
  readonly conversationId: string
  readonly intent: string
  readonly outcome: AsyraDesignAiConversationOutcome
  readonly progress: readonly AiRuntimeProgressUpdate[]
  readonly result: unknown
  readonly turnId: string
}

export interface AsyraDesignAiConversationSnapshot {
  readonly activeTurn: AsyraDesignAiActiveTurn | null
  readonly conversationId: string
  readonly disposed: boolean
  readonly settledTurns: readonly AsyraDesignAiSettledTurn[]
  readonly targetHints: AsyraDesignAiTargetHints
}

export interface CreateAsyraDesignAiConversationControllerOptions {
  readonly confirmation?: {
    beginTurn(turnId: string): void
    cancel(reason?: unknown): boolean
    endTurn(turnId: string): void
  }
  readonly createConversationId?: () => string
  readonly feature: AsyraDesignAiConversationFeature
  readonly getElementType: (elementId: string) => string | undefined
  readonly history?: {
    beginTurn(turnId: string): void
    endTurn(turnId: string): void
  }
}

export type AsyraDesignAiConversationErrorCode =
  | 'AI_CONVERSATION_DISPOSED'
  | 'AI_CONVERSATION_INVALID_INTENT'
  | 'AI_CONVERSATION_TURN_ACTIVE'

export class AsyraDesignAiConversationError extends Error {
  readonly code: AsyraDesignAiConversationErrorCode

  constructor(code: AsyraDesignAiConversationErrorCode) {
    let message = 'AI conversation already has an active turn.'
    if (code === 'AI_CONVERSATION_DISPOSED') {
      message = 'AI conversation controller is disposed.'
    } else if (code === 'AI_CONVERSATION_INVALID_INTENT') {
      message = 'AI conversation intent must be non-empty.'
    }
    super(message)
    this.name = 'AsyraDesignAiConversationError'
    this.code = code
  }
}

interface MutableActiveTurn {
  cancelled: boolean
  readonly conversationId: string
  readonly intent: string
  readonly progress: AiRuntimeProgressUpdate[]
  readonly turnId: string
}

const EMPTY_TARGET_HINTS: AsyraDesignAiTargetHints = Object.freeze({
  compositionId: null,
  roleToElementIds: Object.freeze({})
})

const createDefaultConversationId = (): string =>
  `conversation-${globalThis.crypto.randomUUID()}`

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const freezeTargetHints = (
  compositionId: string | null,
  source: Readonly<Record<string, readonly string[]>>
): AsyraDesignAiTargetHints => {
  const roles: Record<string, readonly string[]> = {}
  Object.entries(source).forEach(([role, elementIds]) => {
    roles[role] = Object.freeze([...elementIds])
  })
  return Object.freeze({
    compositionId,
    roleToElementIds: Object.freeze(roles)
  })
}

const readActionResultStatus = (
  value: unknown
): 'complete' | 'no-change' | 'partial' | null => {
  if (!isPlainObject(value)) {
    return null
  }
  return value.status === 'complete' ||
    value.status === 'no-change' ||
    value.status === 'partial'
    ? value.status
    : null
}

const readActionResults = (
  value: unknown
): readonly Record<string, unknown>[] => {
  if (!isPlainObject(value) || !Array.isArray(value.actionResults)) {
    return []
  }
  return value.actionResults.filter(isPlainObject)
}

const outcomeForResult = (
  result: unknown,
  cancelled: boolean
): AsyraDesignAiConversationOutcome => {
  if (cancelled) {
    return 'cancelled'
  }
  if (!isPlainObject(result)) {
    return 'failed'
  }
  if (result.status === 'unavailable') {
    return 'unavailable'
  }
  if (result.status === 'cancelled') {
    return 'cancelled'
  }
  if (result.status !== 'executed') {
    return 'failed'
  }

  const statuses = readActionResults(result)
    .map((action) => readActionResultStatus(action.result))
    .filter((status): status is 'complete' | 'no-change' | 'partial' =>
      Boolean(status)
    )
  if (statuses.includes('partial')) {
    return 'partial'
  }
  if (
    statuses.length > 0 &&
    statuses.every((status) => status === 'no-change')
  ) {
    return 'no-change'
  }
  return 'success'
}

const roleMappingsFromResult = (
  value: unknown
): Readonly<Record<string, readonly string[]>> | null => {
  if (!isPlainObject(value) || !isPlainObject(value.roleToElementIds)) {
    return null
  }
  const result: Record<string, readonly string[]> = {}
  for (const [role, sourceIds] of Object.entries(value.roleToElementIds)) {
    if (!Array.isArray(sourceIds)) {
      continue
    }
    const elementIds = sourceIds.filter(
      (elementId): elementId is string =>
        typeof elementId === 'string' && elementId.length > 0
    )
    if (elementIds.length > 0) {
      result[role] = Object.freeze([...new Set(elementIds)])
    }
  }
  return Object.freeze(result)
}

export const createAsyraDesignAiConversationController = (
  options: CreateAsyraDesignAiConversationControllerOptions
) => {
  const conversationId = (
    options.createConversationId ?? createDefaultConversationId
  )()
  if (!conversationId.trim()) {
    throw new AsyraDesignAiConversationError('AI_CONVERSATION_INVALID_INTENT')
  }

  const settledTurns: AsyraDesignAiSettledTurn[] = []
  const observers = new Set<
    (snapshot: AsyraDesignAiConversationSnapshot) => void
  >()
  let activeTurn: MutableActiveTurn | null = null
  let activeSettlement: Promise<unknown> | null = null
  let disposed = false
  let targetHints = EMPTY_TARGET_HINTS
  let turnIndex = 0

  const revalidateTargetHints = (): AsyraDesignAiTargetHints => {
    const compositionId =
      targetHints.compositionId &&
      options.getElementType(targetHints.compositionId) === 'group'
        ? targetHints.compositionId
        : null
    const roles: Record<string, readonly string[]> = {}
    Object.entries(targetHints.roleToElementIds).forEach(
      ([role, elementIds]) => {
        const validIds = elementIds.filter((elementId) => {
          const type = options.getElementType(elementId)
          return type === 'oval' || type === 'vector'
        })
        if (validIds.length > 0) {
          roles[role] = Object.freeze([...new Set(validIds)])
        }
      }
    )
    targetHints = freezeTargetHints(compositionId, roles)
    return targetHints
  }

  const getSnapshot = (): AsyraDesignAiConversationSnapshot =>
    Object.freeze({
      activeTurn:
        activeTurn === null
          ? null
          : Object.freeze({
              conversationId: activeTurn.conversationId,
              intent: activeTurn.intent,
              progress: Object.freeze([...activeTurn.progress]),
              turnId: activeTurn.turnId
            }),
      conversationId,
      disposed,
      settledTurns: Object.freeze([...settledTurns]),
      targetHints
    })

  const observeSafely = (
    observer: (snapshot: AsyraDesignAiConversationSnapshot) => void,
    snapshot: AsyraDesignAiConversationSnapshot
  ) => {
    try {
      observer(snapshot)
    } catch {
      // Presentation observers are detached from conversation semantics.
    }
  }

  const notify = () => {
    const snapshot = getSnapshot()
    observers.forEach((observer) => {
      observeSafely(observer, snapshot)
    })
  }

  const updateTargetHints = (result: unknown) => {
    for (const action of readActionResults(result)) {
      const actionResult = action.result
      const status = readActionResultStatus(actionResult)
      if (action.actionName === 'remove_ai_composition') {
        if (status === 'complete' || status === 'partial') {
          targetHints = EMPTY_TARGET_HINTS
        }
        continue
      }
      if (
        action.actionName !== 'insert_vector_composition' ||
        (status !== 'complete' && status !== 'partial') ||
        !isPlainObject(actionResult)
      ) {
        continue
      }
      const roleToElementIds = roleMappingsFromResult(actionResult)
      if (
        typeof actionResult.compositionId === 'string' &&
        actionResult.compositionId.length > 0 &&
        roleToElementIds
      ) {
        targetHints = freezeTargetHints(
          actionResult.compositionId,
          roleToElementIds
        )
      }
    }
  }

  const controller = {
    submit: async (sourceIntent: string): Promise<AsyraDesignAiSettledTurn> => {
      if (disposed) {
        throw new AsyraDesignAiConversationError('AI_CONVERSATION_DISPOSED')
      }
      const intent = sourceIntent.trim()
      if (!intent) {
        throw new AsyraDesignAiConversationError(
          'AI_CONVERSATION_INVALID_INTENT'
        )
      }
      if (activeTurn) {
        throw new AsyraDesignAiConversationError('AI_CONVERSATION_TURN_ACTIVE')
      }

      turnIndex += 1
      const currentTurn: MutableActiveTurn = {
        cancelled: false,
        conversationId,
        intent,
        progress: [],
        turnId: `${conversationId}:turn:${turnIndex}`
      }
      activeTurn = currentTurn
      options.confirmation?.beginTurn(currentTurn.turnId)
      options.history?.beginTurn(currentTurn.turnId)
      const aiTargets = revalidateTargetHints()
      notify()

      const progressObserver: AiRuntimeProgressObserver = (update) => {
        if (disposed || activeTurn !== currentTurn || currentTurn.cancelled) {
          return
        }
        currentTurn.progress.push(update)
        notify()
      }

      let result: unknown
      try {
        const featureSettlement = options.feature.execute({
          intent,
          metadata: {
            aiTargets,
            conversationId,
            turnId: currentTurn.turnId
          },
          progressObserver
        })
        activeSettlement = featureSettlement
        result = await featureSettlement
      } catch (error) {
        result = Object.freeze({
          code:
            isPlainObject(error) && typeof error.code === 'string'
              ? error.code
              : 'AI_FEATURE_FAILED',
          stage: 'feature',
          status: 'failed'
        })
      }

      const settled = Object.freeze({
        conversationId,
        intent,
        outcome: outcomeForResult(result, currentTurn.cancelled || disposed),
        progress: Object.freeze([...currentTurn.progress]),
        result,
        turnId: currentTurn.turnId
      })
      if (!currentTurn.cancelled && !disposed) {
        updateTargetHints(result)
      }
      options.confirmation?.endTurn(currentTurn.turnId)
      options.history?.endTurn(currentTurn.turnId)
      if (activeTurn === currentTurn) {
        activeTurn = null
      }
      activeSettlement = null
      if (!disposed) {
        settledTurns.push(settled)
        notify()
      }
      return settled
    },
    cancel: (reason?: unknown): boolean => {
      if (!activeTurn || disposed) {
        return false
      }
      activeTurn.cancelled = true
      options.confirmation?.cancel(reason)
      const cancelled = options.feature.cancel(reason)
      notify()
      return cancelled
    },
    getSnapshot,
    subscribe: (
      observer: (snapshot: AsyraDesignAiConversationSnapshot) => void
    ): (() => void) => {
      if (disposed) {
        return () => undefined
      }
      observers.add(observer)
      observeSafely(observer, getSnapshot())
      return () => {
        observers.delete(observer)
      }
    },
    dispose: async (): Promise<void> => {
      if (disposed) {
        return
      }
      if (activeTurn) {
        activeTurn.cancelled = true
        options.confirmation?.cancel('conversation-disposed')
        options.feature.cancel('conversation-disposed')
      }
      const pendingSettlement = activeSettlement
      disposed = true
      activeTurn = null
      targetHints = EMPTY_TARGET_HINTS
      settledTurns.length = 0
      observers.clear()
      if (pendingSettlement) {
        await pendingSettlement.catch(() => undefined)
      }
      activeSettlement = null
    }
  }

  return Object.freeze(controller)
}

export type AsyraDesignAiConversationController = ReturnType<
  typeof createAsyraDesignAiConversationController
>
