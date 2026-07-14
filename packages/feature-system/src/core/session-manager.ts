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
import { interactionQueue } from './interaction-queue'

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
  failure: CapturedFailure
}

interface CapturedFailure {
  failed: boolean
  error: unknown
}

let activeSessionManager: SessionManager | undefined

const setActiveSessionManager = (manager: SessionManager | undefined): void => {
  activeSessionManager = manager
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
    abortController?: AbortController,
    forcedRollback = false
  ): Promise<CleanupResult> {
    let outcome: SessionCancelOutcome = 'commit-current'
    let failed = false
    let firstError: unknown

    for (const participant of participants) {
      const state = states.get(participant.featureName)
      if (state === undefined) {
        continue
      }

      try {
        const shouldFinalizeCurrent =
          !forcedRollback && participant.cancelPolicy === 'commit-current'
        const requestedOutcome = shouldFinalizeCurrent
          ? await this.runWithTimeout(
              () => participant.handler.onEnd?.(snapshot, state),
              `${participant.featureName}.onEnd(interrupted)`,
              abortController
            )
          : participant.handler.onCancel
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
        if (!failed) {
          failed = true
          firstError = error
        }
        outcome = 'rollback'
      }
    }

    return {
      outcome,
      failure: { failed, error: firstError }
    }
  }

  private async cancelSession(
    sessionName: string,
    snapshot: SystemContextSnapshotWithDetail,
    forcedFailure?: CapturedFailure
  ): Promise<CapturedFailure> {
    const session = this.activeSessions.get(sessionName)
    if (!session) {
      return forcedFailure ?? { failed: false, error: undefined }
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
      session.abortController,
      forcedFailure?.failed === true
    )
    this.activeSessions.delete(sessionName)
    this.releaseRuntimeOwnershipIfIdle()

    const failure = forcedFailure?.failed ? forcedFailure : cleanup.failure
    const shouldRollback = failure.failed || cleanup.outcome === 'rollback'
    endTransaction(
      shouldRollback
        ? {
            outcome: 'rollback',
            failure: failure.failed
              ? this.toTransactionFailure(failure.error)
              : { kind: 'cancelled' }
          }
        : { outcome: 'commit' }
    )

    return failure
  }

  /**
   * Registers either the legacy handler-only form or an explicit cancel policy.
   */
  registerSession(
    sessionName: string,
    featureName: string,
    priority: number,
    exclusive: boolean,
    handler: SessionHandler
  ): void
  registerSession(
    sessionName: string,
    featureName: string,
    priority: number,
    exclusive: boolean,
    cancelPolicy: SessionCancelPolicy,
    handler: SessionHandler
  ): void
  registerSession(
    sessionName: string,
    featureName: string,
    priority: number,
    exclusive: boolean,
    cancelPolicyOrHandler: SessionCancelPolicy | SessionHandler,
    explicitHandler?: SessionHandler
  ): void {
    const cancelPolicy =
      typeof cancelPolicyOrHandler === 'string'
        ? cancelPolicyOrHandler
        : 'commit-current'
    const handler =
      typeof cancelPolicyOrHandler === 'string'
        ? explicitHandler
        : cancelPolicyOrHandler
    if (!handler) {
      throw new Error(`Feature ${featureName} must provide a session handler`)
    }
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

  handleStart(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<boolean> {
    return interactionQueue.run(async () => {
      if (!this.sessionHandlers.has(sessionName)) {
        return false
      }
      await this.cancelRuntimeActiveSessionsNow(
        this.withDetail(snapshot, {
          cancelled: true,
          cancelledBy: `${sessionName}.start`
        }) as SystemContextSnapshotWithDetail
      )
      return this.handleStartNow(sessionName, snapshot)
    })
  }

  handleSessionInput(
    sessionName: string,
    phase: 'start' | 'update' | 'end',
    getSnapshot: () => SystemContextSnapshotWithDetail,
    cancelledBy: string
  ): Promise<boolean | undefined> {
    return interactionQueue.run(async () => {
      const snapshot = getSnapshot()
      if (phase === 'start') {
        await this.cancelRuntimeActiveSessionsNow({
          ...snapshot,
          detail: {
            ...snapshot.detail,
            cancelled: true,
            cancelledBy
          }
        })
        return this.handleStartNow(sessionName, snapshot)
      }
      if (phase === 'update') {
        await this.handleUpdateNow(sessionName, snapshot)
        return undefined
      }
      await this.handleEndNow(sessionName, snapshot)
      return undefined
    })
  }

  handleUpdate(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    return interactionQueue.run(() =>
      this.handleUpdateNow(sessionName, snapshot)
    )
  }

  handleEnd(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    return interactionQueue.run(() => this.handleEndNow(sessionName, snapshot))
  }

  cancelActiveSessions(
    snapshot: SystemContextSnapshotWithDetail
  ): Promise<void> {
    return interactionQueue.run(() =>
      this.cancelRuntimeActiveSessionsNow(snapshot)
    )
  }

  runAfterCancellingActiveSessions<T>(
    getSnapshot: () => SystemContextSnapshotWithDetail,
    operation: (snapshot: SystemContextSnapshotWithDetail) => T | Promise<T>,
    cancelledBy: string
  ): Promise<T> {
    return interactionQueue.run(async () => {
      const snapshot = getSnapshot()
      await this.cancelRuntimeActiveSessionsNow({
        ...snapshot,
        detail: {
          ...snapshot.detail,
          cancelled: true,
          cancelledBy
        }
      })
      return operation(snapshot)
    })
  }

  private async handleStartNow(
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
          abortController,
          true
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
    setActiveSessionManager(this)
    return true
  }

  private async handleUpdateNow(
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
          { failed: true, error }
        )
        throw error
      }
    }
  }

  private async handleEndNow(
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
    let failed = false
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
        if (!failed) {
          failed = true
          firstError = error
        }
      }
    }

    this.activeSessions.delete(sessionName)
    this.releaseRuntimeOwnershipIfIdle()
    if (failed) {
      session.abortController?.abort()
    }
    endTransaction(
      failed
        ? {
            outcome: 'rollback',
            failure: this.toTransactionFailure(firstError)
          }
        : { outcome: 'commit' }
    )
    if (failed) {
      throw firstError
    }
  }

  private async cancelActiveSessionsNow(
    snapshot: SystemContextSnapshotWithDetail
  ): Promise<void> {
    let failed = false
    let firstError: unknown
    for (const sessionName of [...this.activeSessions.keys()]) {
      const failure = await this.cancelSession(sessionName, snapshot)
      if (failure.failed && !failed) {
        failed = true
        firstError = failure.error
      }
    }
    if (failed) {
      throw firstError
    }
  }

  private async cancelRuntimeActiveSessionsNow(
    snapshot: SystemContextSnapshotWithDetail
  ): Promise<void> {
    const manager = activeSessionManager
    if (!manager) {
      return
    }
    await manager.cancelActiveSessionsNow(snapshot)
  }

  private releaseRuntimeOwnershipIfIdle(): void {
    if (activeSessionManager === this && this.activeSessions.size === 0) {
      setActiveSessionManager(undefined)
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
    this.releaseRuntimeOwnershipIfIdle()
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
