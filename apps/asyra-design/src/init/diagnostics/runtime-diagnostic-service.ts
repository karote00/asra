import { getActiveCollaborationHandle } from '../../collaboration/lifecycle'
import { RuntimeDiagnosticEvents } from '../../constants'
import { getActiveAiDrawingPerformanceProfile } from '../performance/ai-drawing-performance-profile'

export const RUNTIME_DIAGNOSTIC_REQUEST_EVENT = RuntimeDiagnosticEvents.REQUEST

export interface RuntimeDiagnosticRequest {
  readonly args?: readonly unknown[]
  readonly operation: string
  error?: string
  response?: unknown
}

interface CollaborationDiagnosticState {
  failed: number
  lastPublicationFailure: {
    cause: { message: string; name: string } | null
    direction: string | null
    message: string
    name: string
    publicationId: string | null
    status: string | null
  } | null
  localSent: number
  remoteProcessed: number
}

const profileOperations = new Set([
  'getRuntimeEvidence',
  'readCanonicalElementCount',
  'readCanonicalElements',
  'readCanonicalOwnerSnapshot',
  'readConversationSnapshot',
  'readCounterTotal',
  'readFactoryPublicationCount',
  'readHistoryDepth',
  'readLatestFactoryTransactionStatus',
  'readLatestPhaseSample',
  'readLatestTurnSettlement',
  'readPhaseCount',
  'readRenderProjectionElementCount',
  'readViewportPosition',
  'readZoom',
  'reset',
  'snapshot'
])

const cloneResponse = (value: unknown): unknown =>
  value === undefined ? undefined : structuredClone(value)

export const installRuntimeDiagnosticService = (): (() => void) => {
  let collaborationDisposer: (() => void) | null = null
  let collaborationDiagnostics: CollaborationDiagnosticState = {
    failed: 0,
    lastPublicationFailure: null,
    localSent: 0,
    remoteProcessed: 0
  }
  const resetCollaborationDiagnostics = (): void => {
    collaborationDisposer?.()
    collaborationDisposer = null
    collaborationDiagnostics = {
      failed: 0,
      lastPublicationFailure: null,
      localSent: 0,
      remoteProcessed: 0
    }
    const collaboration = getActiveCollaborationHandle()
    collaborationDisposer =
      collaboration?.observePublicationOutcomes((outcome) => {
        if (outcome.direction === 'local' && outcome.status === 'sent') {
          collaborationDiagnostics.localSent += 1
        }
        if (outcome.direction === 'remote' && outcome.status === 'processed') {
          collaborationDiagnostics.remoteProcessed += 1
        }
        if (
          outcome.status !== 'send-failed' &&
          outcome.status !== 'process-failed'
        ) {
          return
        }
        collaborationDiagnostics.failed += 1
        const error =
          outcome.error instanceof Error
            ? outcome.error
            : new Error(String(outcome.error ?? 'Unknown collaboration error'))
        const cause =
          error.cause instanceof Error
            ? {
                message: error.cause.message.slice(0, 300),
                name: error.cause.name.slice(0, 80)
              }
            : null
        collaborationDiagnostics.lastPublicationFailure = {
          cause,
          direction: outcome.direction.slice(0, 40),
          message: error.message.slice(0, 300),
          name: error.name.slice(0, 80),
          publicationId: outcome.publicationId.slice(0, 160),
          status: outcome.status.slice(0, 40)
        }
      }) ?? null
  }
  const handleRequest = (event: Event): void => {
    const request = (event as CustomEvent<RuntimeDiagnosticRequest>).detail
    if (!request || typeof request.operation !== 'string') return
    try {
      if (request.operation === 'collaboration:get-status') {
        request.response =
          getActiveCollaborationHandle()?.getStatus() ?? 'missing'
        return
      }
      if (request.operation === 'collaboration:reset-outcomes') {
        resetCollaborationDiagnostics()
        request.response = null
        return
      }
      if (request.operation === 'collaboration:read-outcomes') {
        request.response = cloneResponse(collaborationDiagnostics)
        return
      }
      if (request.operation === 'profile:read-actor-sample') {
        const profile = getActiveAiDrawingPerformanceProfile()
        if (!profile) {
          throw new Error('AI drawing performance profile is unavailable')
        }
        request.response = cloneResponse({
          canonicalElements: profile.readCanonicalElementCount(),
          factoryPublications: profile.readFactoryPublicationCount(),
          failed: collaborationDiagnostics.failed,
          historyDepth: profile.readHistoryDepth(),
          lastPublicationFailure:
            collaborationDiagnostics.lastPublicationFailure,
          latestFactoryTransactionStatus:
            profile.readLatestFactoryTransactionStatus(),
          latestOwnerTiming: profile.readLatestPhaseSample(),
          latestTurnSettlement: profile.readLatestTurnSettlement(),
          localSent: collaborationDiagnostics.localSent,
          nonSuccessfulTurnCount:
            profile.readCounterTotal('ai-turn:outcome:cancelled') +
            profile.readCounterTotal('ai-turn:outcome:failed') +
            profile.readCounterTotal('ai-turn:outcome:no-change') +
            profile.readCounterTotal('ai-turn:outcome:partial'),
          remoteProcessed: collaborationDiagnostics.remoteProcessed,
          renderProjectionElements: profile.readRenderProjectionElementCount(),
          successfulTurnCount: profile.readCounterTotal(
            'ai-turn:outcome:success'
          )
        })
        return
      }
      const operation = request.operation.replace(/^profile:/u, '')
      if (
        operation === request.operation ||
        !profileOperations.has(operation)
      ) {
        throw new Error(
          `Unsupported runtime diagnostic operation: ${request.operation}`
        )
      }
      const profile = getActiveAiDrawingPerformanceProfile()
      if (!profile) {
        throw new Error('AI drawing performance profile is unavailable')
      }
      const method = profile[operation as keyof typeof profile]
      if (typeof method !== 'function') {
        throw new Error(
          `Runtime diagnostic operation is not callable: ${request.operation}`
        )
      }
      request.response = cloneResponse(
        Reflect.apply(method, profile, request.args ?? [])
      )
    } catch (error) {
      request.error = error instanceof Error ? error.message : String(error)
    }
  }
  document.addEventListener(RUNTIME_DIAGNOSTIC_REQUEST_EVENT, handleRequest)
  return () => {
    collaborationDisposer?.()
    document.removeEventListener(
      RUNTIME_DIAGNOSTIC_REQUEST_EVENT,
      handleRequest
    )
  }
}
