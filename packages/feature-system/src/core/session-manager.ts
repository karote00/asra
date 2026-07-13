import type {
  ActiveSession,
  SessionCancelOutcome,
  SessionCancelPolicy,
  SessionHandler,
  SessionParticipant,
  SessionState
} from '../types/feature'
import type {
  SystemContextSnapshot,
  SystemContextSnapshotWithDetail,
  TransactionFailure
} from '@asyra/utils'
import { endTransaction, startTransaction } from '@asyra/reactive-events'

const DEFAULT_HANDLER_TIMEOUT_MS = 5000

export class FeatureHandlerTimeoutError extends Error {
  readonly label: string
  readonly timeoutMs: number

  constructor(label: string, timeoutMs: number) {
    super(`Session handler timeout: ${label}`)
    this.name = 'FeatureHandlerTimeoutError'
    this.label = label
    this.timeoutMs = timeoutMs
  }
}

const measureBrowserDragAsyncPhase = async <T>(
  phaseName: string,
  run: () => Promise<T>
): Promise<T> => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return await run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

interface CleanupResult {
  outcome: SessionCancelOutcome
  error?: unknown
}

export class SessionManager {
  private activeSessions = new Map<string, ActiveSession>()
  private sessionHandlers = new Map<string, SessionParticipant[]>()
  private handlerTimeoutMs = DEFAULT_HANDLER_TIMEOUT_MS

  private withDetail(
    snapshot: SystemContextSnapshot,
    detail: Record<string, unknown>,
    signal?: AbortSignal
  ): SystemContextSnapshot {
    const existingDetail =
      (snapshot as SystemContextSnapshotWithDetail).detail ?? {}

    return {
      ...snapshot,
      detail: {
        ...existingDetail,
        ...detail,
        ...(signal ? { signal } : {})
      }
    } as SystemContextSnapshot
  }

  private async runWithTimeout<T>(
    handler: (() => T | Promise<T>) | undefined,
    label: string,
    abortController?: AbortController
  ): Promise<T | undefined> {
    if (!handler) {
      return undefined
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      return (await Promise.race([
        Promise.resolve().then(handler),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            abortController?.abort()
            reject(new FeatureHandlerTimeoutError(label, this.handlerTimeoutMs))
          }, this.handlerTimeoutMs)
        })
      ])) as T
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
    }
  }

  private toTransactionFailure(error: unknown): TransactionFailure {
    return {
      kind:
        error instanceof FeatureHandlerTimeoutError
          ? 'handler-timeout'
          : 'handler-error',
      message: error instanceof Error ? error.message : undefined,
      cause: error
    }
  }

  private async cleanupParticipants(
    participants: readonly SessionParticipant[],
    states: ReadonlyMap<string, SessionState>,
    snapshot: SystemContextSnapshot,
    abortController?: AbortController
  ): Promise<CleanupResult> {
    let outcome: SessionCancelOutcome = 'commit-current'
    let firstError: unknown

    for (const participant of participants) {
      const state = states.get(participant.featureName)
      if (state === undefined) {
        continue
      }

      try {
        const requestedOutcome = participant.handler.onCancel
          ? await this.runWithTimeout(
              () => participant.handler.onCancel?.(snapshot, state),
              `${participant.featureName}.onCancel`,
              abortController
            )
          : await this.runWithTimeout(
              () => participant.handler.onEnd?.(snapshot, state),
              `${participant.featureName}.onEnd(cancel-fallback)`,
              abortController
            )

        let participantOutcome: SessionCancelOutcome
        if (participant.cancelPolicy === 'feature-defined') {
          if (
            requestedOutcome !== 'rollback' &&
            requestedOutcome !== 'commit-current'
          ) {
            throw new Error(
              `Feature ${participant.featureName} onCancel must return rollback or commit-current`
            )
          }
          participantOutcome = requestedOutcome
        } else {
          participantOutcome = participant.cancelPolicy
        }

        if (participantOutcome === 'rollback') {
          outcome = 'rollback'
        }
      } catch (error) {
        firstError ??= error
        outcome = 'rollback'
      }
    }

    return {
      outcome,
      ...(firstError !== undefined ? { error: firstError } : {})
    }
  }

  private async cancelSession(
    sessionName: string,
    snapshot: SystemContextSnapshotWithDetail,
    forcedError?: unknown
  ): Promise<unknown | undefined> {
    const session = this.activeSessions.get(sessionName)
    if (!session) {
      return forcedError
    }

    session.abortController?.abort()
    const currentDetail = snapshot.detail ?? {}
    const cleanupSnapshot = this.withDetail(
      snapshot,
      {
        cancelled: true,
        cancelledBy: currentDetail.cancelledBy ?? sessionName
      },
      session.abortController?.signal
    )
    const cleanup = await this.cleanupParticipants(
      session.participants,
      session.states,
      cleanupSnapshot,
      session.abortController
    )
    this.activeSessions.delete(sessionName)

    const failure = forcedError ?? cleanup.error
    const shouldRollback =
      failure !== undefined || cleanup.outcome === 'rollback'
    endTransaction(
      shouldRollback
        ? {
            outcome: 'rollback',
            failure:
              failure !== undefined
                ? this.toTransactionFailure(failure)
                : { kind: 'cancelled' }
          }
        : { outcome: 'commit' }
    )

    return failure
  }

  registerSession(
    sessionName: string,
    featureName: string,
    priority: number,
    exclusive: boolean,
    cancelPolicy: SessionCancelPolicy,
    handler: SessionHandler
  ): void {
    if (cancelPolicy === 'feature-defined' && !handler.onCancel) {
      throw new Error(
        `Feature ${featureName} uses feature-defined cancelPolicy without onCancel`
      )
    }

    const participant: SessionParticipant = {
      featureName,
      priority,
      exclusive,
      cancelPolicy,
      handler,
      state: null
    }

    const handlers = this.sessionHandlers.get(sessionName) ?? []
    handlers.push(participant)
    handlers.sort((left, right) => right.priority - left.priority)
    this.sessionHandlers.set(sessionName, handlers)
  }

  async handleStart(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<boolean> {
    const handlers = this.sessionHandlers.get(sessionName)
    if (!handlers || handlers.length === 0) {
      return false
    }

    startTransaction()
    const abortController = new AbortController()
    const snapshotWithSignal = this.withDetail(
      snapshot,
      { sessionName },
      abortController.signal
    )
    const participants: SessionParticipant[] = []
    const states = new Map<string, SessionState>()
    let exclusiveFound = false

    for (const participant of handlers) {
      if (exclusiveFound) {
        break
      }

      try {
        const state = await this.runWithTimeout(
          () => participant.handler.onStart?.(snapshotWithSignal),
          `${participant.featureName}.onStart`,
          abortController
        )
        if (state === null || state === undefined) {
          continue
        }

        participants.push({ ...participant, state })
        states.set(participant.featureName, state)
        if (participant.exclusive) {
          exclusiveFound = true
        }
      } catch (error) {
        abortController.abort()
        await this.cleanupParticipants(
          participants,
          states,
          this.withDetail(
            snapshotWithSignal,
            {
              cancelled: true,
              cancelledBy: `${participant.featureName}.onStart`
            },
            abortController.signal
          ),
          abortController
        )
        endTransaction({
          outcome: 'rollback',
          failure: this.toTransactionFailure(error)
        })
        throw error
      }
    }

    if (participants.length === 0) {
      endTransaction()
      return false
    }

    this.activeSessions.set(sessionName, {
      name: sessionName,
      participants,
      startTime: Date.now(),
      states,
      abortController
    })
    return true
  }

  async handleUpdate(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    const session = this.activeSessions.get(sessionName)
    if (!session) {
      return
    }

    const snapshotWithSignal = this.withDetail(
      snapshot,
      { sessionName },
      session.abortController?.signal
    )

    for (const participant of session.participants) {
      const state = session.states.get(participant.featureName)
      if (state === undefined) {
        continue
      }

      try {
        await measureBrowserDragAsyncPhase(
          `feature-session:${participant.featureName}.onUpdate`,
          () =>
            this.runWithTimeout(
              () => participant.handler.onUpdate?.(snapshotWithSignal, state),
              `${participant.featureName}.onUpdate`,
              session.abortController
            )
        )
      } catch (error) {
        await this.cancelSession(
          sessionName,
          this.withDetail(snapshotWithSignal, {
            cancelled: true,
            cancelledBy: `${participant.featureName}.onUpdate`
          }) as SystemContextSnapshotWithDetail,
          error
        )
        throw error
      }
    }
  }

  async handleEnd(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    const session = this.activeSessions.get(sessionName)
    if (!session) {
      return
    }

    const snapshotWithSignal = this.withDetail(
      snapshot,
      { sessionName },
      session.abortController?.signal
    )
    let firstError: unknown

    for (const participant of session.participants) {
      const state = session.states.get(participant.featureName)
      if (state === undefined) {
        continue
      }

      try {
        await this.runWithTimeout(
          () => participant.handler.onEnd?.(snapshotWithSignal, state),
          `${participant.featureName}.onEnd`,
          session.abortController
        )
      } catch (error) {
        firstError ??= error
      }
    }

    this.activeSessions.delete(sessionName)
    if (firstError !== undefined) {
      session.abortController?.abort()
    }
    endTransaction(
      firstError === undefined
        ? { outcome: 'commit' }
        : {
            outcome: 'rollback',
            failure: this.toTransactionFailure(firstError)
          }
    )
    if (firstError !== undefined) {
      throw firstError
    }
  }

  async cancelActiveSessions(
    snapshot: SystemContextSnapshotWithDetail
  ): Promise<void> {
    let firstError: unknown
    for (const sessionName of [...this.activeSessions.keys()]) {
      const error = await this.cancelSession(sessionName, snapshot)
      firstError ??= error
    }
    if (firstError !== undefined) {
      throw firstError
    }
  }

  getActiveSession(sessionName: string): ActiveSession | undefined {
    return this.activeSessions.get(sessionName)
  }

  getRegisteredSessionNames(): string[] {
    return Array.from(this.sessionHandlers.keys())
  }

  getAllActiveSessions(): Map<string, ActiveSession> {
    return new Map(this.activeSessions)
  }

  clearAll(): void {
    this.activeSessions.clear()
  }

  unregisterSession(sessionName: string, featureName: string): boolean {
    const handlers = this.sessionHandlers.get(sessionName)
    if (!handlers) {
      return false
    }

    const index = handlers.findIndex(
      (handler) => handler.featureName === featureName
    )
    if (index === -1) {
      return false
    }

    handlers.splice(index, 1)
    if (handlers.length === 0) {
      this.sessionHandlers.delete(sessionName)
    }
    return true
  }
}
