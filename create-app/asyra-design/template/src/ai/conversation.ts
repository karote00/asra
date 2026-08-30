import type {
  AiJsonValue,
  AiRuntimeProgressObserver,
  AiRuntimeProgressUpdate
} from '@asyra/ai-agent-runtime'

export type AiConversationOutcome =
  'cancelled' | 'failed' | 'no-change' | 'partial' | 'success'

export interface AiTargetHints {
  readonly compositionId: string | null
  readonly roleToElementIds: Readonly<Record<string, readonly string[]>>
}

export type AiImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface AiImageAttachment {
  readonly dataUrl: string
  readonly mediaType: AiImageMediaType
  readonly name: string
  readonly size: number
}

export interface AiConversationSubmission {
  readonly attachments?: readonly AiImageAttachment[]
  readonly intent: string
}

export interface AiConversationFeatureRequest {
  readonly intent: string
  readonly metadata: AiJsonValue
  readonly progressObserver: AiRuntimeProgressObserver
}

export interface AiConversationFeature {
  execute(request: AiConversationFeatureRequest): Promise<unknown>
  cancel(reason?: unknown): boolean
}

export interface AiActiveTurn {
  readonly attachments: readonly AiImageAttachment[]
  readonly conversationId: string
  readonly intent: string
  readonly progress: readonly AiRuntimeProgressUpdate[]
  readonly turnId: string
}

export interface AiSettledTurn {
  readonly attachments: readonly AiImageAttachment[]
  readonly conversationId: string
  readonly durationMs: number
  readonly intent: string
  readonly outcome: AiConversationOutcome
  readonly progress: readonly AiRuntimeProgressUpdate[]
  readonly result: unknown
  readonly turnId: string
}

export interface AiConversationSnapshot {
  readonly activeTurn: AiActiveTurn | null
  readonly conversationId: string
  readonly disposed: boolean
  readonly settledTurns: readonly AiSettledTurn[]
  readonly targetHints: AiTargetHints
}

export interface CreateAiConversationControllerOptions {
  readonly confirmation?: {
    beginTurn(turnId: string): void
    cancel(reason?: unknown): boolean
    endTurn(turnId: string): void
  }
  readonly createConversationId?: () => string
  readonly feature: AiConversationFeature
  readonly getElementType: (elementId: string) => string | undefined
  readonly history?: {
    beginTurn(turnId: string): void
    endTurn(turnId: string): void
  }
  readonly now?: () => number
}

export type AiConversationErrorCode =
  | 'AI_CONVERSATION_DISPOSED'
  | 'AI_CONVERSATION_INVALID_ATTACHMENT'
  | 'AI_CONVERSATION_INVALID_INTENT'
  | 'AI_CONVERSATION_TURN_ACTIVE'

export class AiConversationError extends Error {
  readonly code: AiConversationErrorCode

  constructor(code: AiConversationErrorCode) {
    let message = 'AI conversation already has an active turn.'
    if (code === 'AI_CONVERSATION_DISPOSED') {
      message = 'AI conversation controller is disposed.'
    } else if (code === 'AI_CONVERSATION_INVALID_ATTACHMENT') {
      message = 'AI conversation image attachment is invalid.'
    } else if (code === 'AI_CONVERSATION_INVALID_INTENT') {
      message = 'AI conversation intent must be non-empty.'
    }
    super(message)
    this.name = 'AiConversationError'
    this.code = code
  }
}

interface MutableActiveTurn {
  readonly attachments: readonly AiImageAttachment[]
  cancelled: boolean
  readonly conversationId: string
  readonly intent: string
  readonly progress: AiRuntimeProgressUpdate[]
  readonly startedAtMs: number
  readonly turnId: string
}

const EMPTY_TARGET_HINTS: AiTargetHints = Object.freeze({
  compositionId: null,
  roleToElementIds: Object.freeze({})
})

const EMPTY_IMAGE_ATTACHMENTS: readonly AiImageAttachment[] = Object.freeze([])

const ACCEPTED_IMAGE_MEDIA_TYPES = new Set<AiImageMediaType>([
  'image/jpeg',
  'image/png',
  'image/webp'
])

const createDefaultConversationId = (): string =>
  `conversation-${globalThis.crypto.randomUUID()}`

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const normalizeImageAttachments = (
  value: unknown
): readonly AiImageAttachment[] => {
  if (value === undefined) {
    return EMPTY_IMAGE_ATTACHMENTS
  }
  if (!Array.isArray(value)) {
    throw new AiConversationError('AI_CONVERSATION_INVALID_ATTACHMENT')
  }
  return Object.freeze(
    value.map((attachment) => {
      if (!isPlainObject(attachment)) {
        throw new AiConversationError('AI_CONVERSATION_INVALID_ATTACHMENT')
      }
      const { dataUrl, mediaType, name, size } = attachment
      if (
        typeof mediaType !== 'string' ||
        !ACCEPTED_IMAGE_MEDIA_TYPES.has(mediaType as AiImageMediaType) ||
        typeof dataUrl !== 'string' ||
        !dataUrl.startsWith(`data:${mediaType};base64,`) ||
        dataUrl.length <= `data:${mediaType};base64,`.length ||
        typeof name !== 'string' ||
        name.trim().length === 0 ||
        typeof size !== 'number' ||
        !Number.isSafeInteger(size) ||
        size <= 0
      ) {
        throw new AiConversationError('AI_CONVERSATION_INVALID_ATTACHMENT')
      }
      return Object.freeze({
        dataUrl,
        mediaType: mediaType as AiImageMediaType,
        name: name.trim(),
        size
      })
    })
  )
}

const normalizeSubmission = (
  source: string | AiConversationSubmission
): {
  readonly attachments: readonly AiImageAttachment[]
  readonly intent: string
} => {
  if (typeof source === 'string') {
    return {
      attachments: EMPTY_IMAGE_ATTACHMENTS,
      intent: source.trim()
    }
  }
  if (!isPlainObject(source) || typeof source.intent !== 'string') {
    throw new AiConversationError('AI_CONVERSATION_INVALID_INTENT')
  }
  return {
    attachments: normalizeImageAttachments(source.attachments),
    intent: source.intent.trim()
  }
}

const freezeTargetHints = (
  compositionId: string | null,
  source: Readonly<Record<string, readonly string[]>>
): AiTargetHints => {
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
): AiConversationOutcome => {
  if (cancelled) {
    return 'cancelled'
  }
  if (!isPlainObject(result)) {
    return 'failed'
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

export const createAiConversationController = (
  options: CreateAiConversationControllerOptions
) => {
  const conversationId = (
    options.createConversationId ?? createDefaultConversationId
  )()
  if (!conversationId.trim()) {
    throw new AiConversationError('AI_CONVERSATION_INVALID_INTENT')
  }

  const settledTurns: AiSettledTurn[] = []
  const observers = new Set<(snapshot: AiConversationSnapshot) => void>()
  let activeTurn: MutableActiveTurn | null = null
  let activeSettlement: Promise<unknown> | null = null
  let disposed = false
  let targetHints = EMPTY_TARGET_HINTS
  let turnIndex = 0
  const now = options.now ?? (() => globalThis.performance.now())

  const revalidateTargetHints = (): AiTargetHints => {
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

  const getSnapshot = (): AiConversationSnapshot =>
    Object.freeze({
      activeTurn:
        activeTurn === null
          ? null
          : Object.freeze({
              attachments: activeTurn.attachments,
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
    observer: (snapshot: AiConversationSnapshot) => void,
    snapshot: AiConversationSnapshot
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
    submit: async (
      source: string | AiConversationSubmission
    ): Promise<AiSettledTurn> => {
      if (disposed) {
        throw new AiConversationError('AI_CONVERSATION_DISPOSED')
      }
      const { attachments, intent } = normalizeSubmission(source)
      if (!intent) {
        throw new AiConversationError('AI_CONVERSATION_INVALID_INTENT')
      }
      if (activeTurn) {
        throw new AiConversationError('AI_CONVERSATION_TURN_ACTIVE')
      }

      const startedAtMs = now()
      turnIndex += 1
      const currentTurn: MutableActiveTurn = {
        attachments,
        cancelled: false,
        conversationId,
        intent,
        progress: [],
        startedAtMs,
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
        const metadata: AiJsonValue = {
          aiTargets: {
            compositionId: aiTargets.compositionId,
            roleToElementIds: Object.fromEntries(
              Object.entries(aiTargets.roleToElementIds).map(
                ([role, elementIds]) => [role, [...elementIds]]
              )
            )
          },
          conversationId,
          ...(attachments.length > 0
            ? {
                imageAttachments: attachments.map((attachment) => ({
                  dataUrl: attachment.dataUrl,
                  mediaType: attachment.mediaType,
                  name: attachment.name,
                  size: attachment.size
                }))
              }
            : {}),
          turnId: currentTurn.turnId
        }
        const featureSettlement = options.feature.execute({
          intent,
          metadata,
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

      const elapsedMs = now() - currentTurn.startedAtMs
      const settled = Object.freeze({
        attachments,
        conversationId,
        durationMs: Number.isFinite(elapsedMs)
          ? Math.max(0, Math.round(elapsedMs))
          : 0,
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
      observer: (snapshot: AiConversationSnapshot) => void
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

export type AiConversationController = ReturnType<
  typeof createAiConversationController
>
