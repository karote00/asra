import {
  ProviderFailure,
  createCollaboration,
  type Collaboration,
  type CollaborationPublicationOutcome,
  type ProcessRemotePublication,
  type ProviderStatus
} from '@asyra/collaboration'
import type { SharedPublication } from '@asyra/factory'
import { settleCooperativeRenderSlice } from '@asyra/reactive-events'
import { idCounter } from '@asyra/utils'
import core, { factory } from '../contexts'
import type { CollaborationMode } from '../render-app/collaboration-mode'
import { createDocumentCollaborationFactory } from './factory-adapter'
import { createFormalInitialDocument } from './initial-document'
import {
  applyDocumentSessionBootstrapTail,
  createPublicationProcessor
} from './operations'
import {
  DocumentPublicationOutbox,
  type PublicationOutboxState,
  type PublicationOutboxStorage
} from './publication-outbox'
import type { DocumentSessionBootstrap } from './protocol'
import { CollaborationWebSocketProvider } from './websocket-provider'

const RECONNECT_INTERVAL_MS = 30_000

export type CollaborationConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'retrying'

export type CollaborationSyncState =
  | 'synced'
  | 'pending'
  | 'reconciling'
  | 'conflicted'
  | 'storage-failed'

export interface CollaborationSessionNotification {
  readonly id: string
  readonly message: string
  readonly type:
    | 'disconnected'
    | 'reconnected'
    | 'storage-failed'
    | 'conflicted'
}

export interface CollaborationSessionState {
  readonly connection: CollaborationConnectionState
  readonly sync: CollaborationSyncState
  readonly pendingCount: number
  readonly disconnectedEpoch: number
  readonly notification?: CollaborationSessionNotification
}

export interface CollaborationDebugHandle {
  readonly identity: Readonly<{
    readonly documentId: string
    readonly roomId: string
    readonly actorId: string
  }>
  getStatus(): ProviderStatus
  onStatusChange(subscriber: (status: ProviderStatus) => void): () => void
  getSessionState(): CollaborationSessionState
  onSessionStateChange(
    subscriber: (state: CollaborationSessionState) => void
  ): () => void
  disconnect(): Promise<void>
  reconnect(): Promise<void>
  whenIdle(): Promise<void>
  observePublicationOutcomes(
    subscriber: (outcome: CollaborationPublicationOutcome) => void
  ): () => void
  dispose(): Promise<void>
}

export interface PreparedCollaborationDocumentSession {
  readonly bootstrap: DocumentSessionBootstrap
  activate(): Promise<CollaborationDebugHandle>
}

interface CollaborationSessionComposition {
  readonly collaboration: Collaboration
  readonly provider: CollaborationWebSocketProvider
}

interface PreparedSocketComposition {
  readonly bootstrap: DocumentSessionBootstrap
  readonly composition: CollaborationSessionComposition
}

const noOutboundFactory = Object.freeze({
  subscribeToSharedPublication: () => () => undefined
})

const createUnavailableStorage = (
  cause: unknown
): PublicationOutboxStorage => ({
  load: async () => {
    throw cause
  },
  put: async () => {
    throw cause
  },
  delete: async () => {
    throw cause
  }
})

const createPublicationOutbox = (fileId: string): DocumentPublicationOutbox => {
  try {
    return new DocumentPublicationOutbox({ fileId })
  } catch (error) {
    return new DocumentPublicationOutbox({
      fileId,
      storage: createUnavailableStorage(error)
    })
  }
}

const createInitialBootstrap = (): DocumentSessionBootstrap =>
  Object.freeze({
    checkpoint: createFormalInitialDocument(),
    durableSequence: 0,
    headSequence: 0,
    pendingTail: Object.freeze([])
  })

const providerStatusForConnection = (
  connection: CollaborationConnectionState,
  disposed: boolean
): ProviderStatus => {
  if (disposed) return 'disposed'
  if (connection === 'connected') return 'connected'
  if (connection === 'connecting' || connection === 'retrying') {
    return 'connecting'
  }
  return 'disconnected'
}

export const createRemotePublicationHandler = (
  applyRemotePublication: (publication: SharedPublication) => boolean,
  settleProjection: () => Promise<void> = settleCooperativeRenderSlice
): ProcessRemotePublication => {
  return async (publication) => {
    const applied = applyRemotePublication(publication)
    if (!applied) {
      throw new Error(
        `[collaboration] remote publication ${publication.publicationId} was rejected`
      )
    }
    await settleProjection()
  }
}

const createSessionComposition = (
  mode: CollaborationMode,
  processRemotePublication: ProcessRemotePublication
): CollaborationSessionComposition => {
  const provider = new CollaborationWebSocketProvider({
    endpoint: mode.endpoint,
    identity: {
      documentId: mode.fileId,
      roomId: mode.fileId,
      actorId: mode.actorId,
      connectionMetadata: { fileId: mode.fileId }
    }
  })
  const collaboration = createCollaboration({
    documentId: mode.fileId,
    roomId: mode.fileId,
    actorId: mode.actorId,
    factory: noOutboundFactory,
    provider,
    processRemotePublication,
    resourceOwnership: { provider: 'owned' }
  })
  return { collaboration, provider }
}

class CollaborationSessionController {
  readonly identity: CollaborationDebugHandle['identity']

  private readonly mode: CollaborationMode
  private readonly processRemotePublication: ProcessRemotePublication
  private readonly outbox: DocumentPublicationOutbox
  private readonly statusSubscribers = new Set<
    (status: ProviderStatus) => void
  >()
  private readonly sessionStateSubscribers = new Set<
    (state: CollaborationSessionState) => void
  >()
  private readonly outcomeSubscribers = new Set<
    (outcome: CollaborationPublicationOutcome) => void
  >()
  private current: CollaborationSessionComposition | undefined
  private preparedSocket: PreparedSocketComposition | undefined
  private unsubscribeProviderStatus: (() => void) | undefined
  private unsubscribeOutcomes: (() => void) | undefined
  private unsubscribeFactory: (() => void) | undefined
  private unsubscribeOutbox: (() => void) | undefined
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined
  private reconnectPromise: Promise<void> | undefined
  private operationQueue: Promise<void> = Promise.resolve()
  private activated = false
  private disposed = false
  private disconnectedEpochActive = false
  private disconnectedEpoch = 0
  private reconciling = false
  private recoveryApplyCutoff = 0
  private readonly recoveryAppliedPublicationIds = new Set<string>()
  private storageFailureReported = false
  private conflictReported = false
  private state: CollaborationSessionState = Object.freeze({
    connection: 'connecting',
    sync: 'synced',
    pendingCount: 0,
    disconnectedEpoch: 0
  })

  constructor(
    mode: CollaborationMode,
    processRemotePublication: ProcessRemotePublication
  ) {
    this.mode = mode
    this.processRemotePublication = processRemotePublication
    this.identity = Object.freeze({
      documentId: mode.fileId,
      roomId: mode.fileId,
      actorId: mode.actorId
    })
    this.outbox = createPublicationOutbox(mode.fileId)
  }

  async prepare(): Promise<DocumentSessionBootstrap> {
    this.unsubscribeOutbox = this.outbox.onStateChange((state) => {
      this.applyOutboxState(state)
    })
    try {
      await this.outbox.initialize()
    } catch (error) {
      console.error('[collaboration] publication outbox load failed:', error)
    }
    this.recoveryApplyCutoff = this.outbox.getLastAppendOrder()
    const documentFactory = createDocumentCollaborationFactory(factory)
    this.unsubscribeFactory = documentFactory.subscribeToSharedPublication(
      (publication) => {
        this.scheduleLocalPublication(publication)
      }
    )

    try {
      const prepared = await this.openSocketComposition()
      this.preparedSocket = prepared
      return prepared.bootstrap
    } catch (error) {
      if (!(error instanceof ProviderFailure)) {
        await this.dispose()
        throw error
      }
      console.error('[collaboration] initial document session failed:', error)
      this.enterDisconnectedEpoch()
      return createInitialBootstrap()
    }
  }

  async activate(): Promise<CollaborationDebugHandle> {
    if (this.disposed) {
      throw new Error('[collaboration] collaboration session is disposed')
    }
    if (this.activated) return this.createHandle()
    this.activated = true

    const prepared = this.preparedSocket
    this.preparedSocket = undefined
    if (prepared) {
      try {
        await this.activateComposition(prepared)
        this.setConnected()
        await this.schedule(() => this.drainOutbox())
      } catch (error) {
        await prepared.composition.collaboration
          .dispose()
          .catch(() => undefined)
        if (!(error instanceof ProviderFailure)) throw error
        console.error(
          '[collaboration] initial document-session activation failed:',
          error
        )
        this.enterDisconnectedEpoch()
        this.scheduleReconnect()
      }
    } else {
      this.enterDisconnectedEpoch()
      this.scheduleReconnect()
    }

    const handle = this.createHandle()
    activeHandle = handle
    window.__Collaboration__ = handle
    return handle
  }

  getStatus(): ProviderStatus {
    return providerStatusForConnection(this.state.connection, this.disposed)
  }

  onStatusChange(subscriber: (status: ProviderStatus) => void): () => void {
    this.statusSubscribers.add(subscriber)
    return () => this.statusSubscribers.delete(subscriber)
  }

  getSessionState(): CollaborationSessionState {
    return this.state
  }

  onSessionStateChange(
    subscriber: (state: CollaborationSessionState) => void
  ): () => void {
    this.sessionStateSubscribers.add(subscriber)
    return () => this.sessionStateSubscribers.delete(subscriber)
  }

  observePublicationOutcomes(
    subscriber: (outcome: CollaborationPublicationOutcome) => void
  ): () => void {
    this.outcomeSubscribers.add(subscriber)
    return () => this.outcomeSubscribers.delete(subscriber)
  }

  async disconnect(): Promise<void> {
    if (this.disposed) return
    this.clearReconnectTimer()
    await this.current?.collaboration.disconnect()
    this.enterDisconnectedEpoch()
    this.scheduleReconnect()
  }

  reconnect(): Promise<void> {
    if (this.disposed) return Promise.resolve()
    this.clearReconnectTimer()
    return this.attemptReconnect()
  }

  async whenIdle(): Promise<void> {
    let queued: Promise<void>
    let reconnecting: Promise<void> | undefined
    do {
      queued = this.operationQueue
      reconnecting = this.reconnectPromise
      await queued
      await reconnecting
      await this.outbox.whenIdle()
      await this.current?.collaboration.whenIdle()
    } while (
      queued !== this.operationQueue ||
      reconnecting !== this.reconnectPromise
    )
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.clearReconnectTimer()
    this.unsubscribeFactory?.()
    this.unsubscribeFactory = undefined
    this.unsubscribeOutbox?.()
    this.unsubscribeOutbox = undefined
    this.unbindCurrentObservers()
    const current = this.current
    const prepared = this.preparedSocket?.composition
    this.current = undefined
    this.preparedSocket = undefined
    await current?.collaboration.dispose().catch(() => undefined)
    if (prepared && prepared !== current) {
      await prepared.collaboration.dispose().catch(() => undefined)
    }
    await this.operationQueue
    await this.outbox.whenIdle()
    this.statusSubscribers.clear()
    this.sessionStateSubscribers.clear()
    this.outcomeSubscribers.clear()
  }

  private createHandle(): CollaborationDebugHandle {
    return {
      identity: this.identity,
      getStatus: () => this.getStatus(),
      onStatusChange: (subscriber) => this.onStatusChange(subscriber),
      getSessionState: () => this.getSessionState(),
      onSessionStateChange: (subscriber) =>
        this.onSessionStateChange(subscriber),
      disconnect: () => this.disconnect(),
      reconnect: () => this.reconnect(),
      whenIdle: () => this.whenIdle(),
      observePublicationOutcomes: (subscriber) =>
        this.observePublicationOutcomes(subscriber),
      dispose: () => this.dispose()
    }
  }

  private async openSocketComposition(): Promise<PreparedSocketComposition> {
    const composition = createSessionComposition(
      this.mode,
      this.processRemotePublication
    )
    try {
      const bootstrap = await composition.provider.openDocumentSession()
      return { bootstrap, composition }
    } catch (error) {
      await composition.collaboration.dispose().catch(() => undefined)
      throw error
    }
  }

  private async activateComposition(
    prepared: PreparedSocketComposition
  ): Promise<void> {
    await applyDocumentSessionBootstrapTail({
      bootstrap: prepared.bootstrap,
      applyPublication: this.processRemotePublication
    })
    await prepared.composition.collaboration.start()
    this.bindCurrent(prepared.composition)
  }

  private bindCurrent(composition: CollaborationSessionComposition): void {
    this.unbindCurrentObservers()
    this.current = composition
    this.unsubscribeProviderStatus = composition.provider.onStatusChange(
      (status) => {
        if (status === 'disconnected' || status === 'failed') {
          this.enterDisconnectedEpoch()
          this.scheduleReconnect()
          return
        }
        if (status === 'connected' && this.activated && !this.reconciling) {
          this.setConnected()
        }
      }
    )
    this.unsubscribeOutcomes =
      composition.collaboration.observePublicationOutcomes((outcome) => {
        this.emitOutcome(outcome)
      })
  }

  private unbindCurrentObservers(): void {
    this.unsubscribeProviderStatus?.()
    this.unsubscribeOutcomes?.()
    this.unsubscribeProviderStatus = undefined
    this.unsubscribeOutcomes = undefined
  }

  private async releaseCurrentComposition(): Promise<void> {
    const current = this.current
    if (!current) return
    this.unbindCurrentObservers()
    this.current = undefined
    await current.collaboration.dispose().catch((error) => {
      console.error(
        '[collaboration] previous document session disposal failed:',
        error
      )
    })
  }

  private scheduleLocalPublication(publication: SharedPublication): void {
    void this.schedule(async () => {
      try {
        await this.outbox.appendFactoryPublication(publication)
      } catch (error) {
        console.error(
          `[collaboration] publication ${publication.publicationId} outbox append failed:`,
          error
        )
      }
      if (this.state.connection === 'connected') {
        await this.drainOutbox()
      }
    })
  }

  private schedule(operation: () => Promise<void>): Promise<void> {
    const result = this.operationQueue.then(operation)
    this.operationQueue = result.catch(() => undefined)
    return result
  }

  private async drainOutbox(): Promise<void> {
    const composition = this.current
    if (
      this.disposed ||
      this.state.connection !== 'connected' ||
      !composition
    ) {
      return
    }

    for (const record of this.outbox.getRecoverablePublications()) {
      if (
        this.disposed ||
        this.state.connection !== 'connected' ||
        this.current !== composition
      ) {
        return
      }
      try {
        const needsRecoveryApply =
          record.appendOrder <= this.recoveryApplyCutoff &&
          !this.recoveryAppliedPublicationIds.has(record.publicationId)
        const acceptance =
          await composition.provider.sendPublicationWithAcceptance(
            record.publication,
            async (acceptedPublication) => {
              if (!needsRecoveryApply) return
              try {
                await this.processRemotePublication(acceptedPublication)
                this.recoveryAppliedPublicationIds.add(record.publicationId)
              } catch (error) {
                await this.retainPublicationConflict(
                  record.publicationId,
                  error
                )
                throw error
              }
            }
          )
        if (acceptance.publicationId !== record.publicationId) {
          throw new ProviderFailure(
            'acknowledgement-failed',
            '[collaboration] source acceptance publication identity mismatch',
            undefined,
            record.publicationId
          )
        }
        await this.outbox.acknowledge(acceptance)
        this.emitOutcome({
          direction: 'local',
          status: 'sent',
          publicationId: record.publicationId
        })
      } catch (error) {
        if (
          error instanceof ProviderFailure &&
          error.code === 'acknowledgement-failed'
        ) {
          try {
            await this.retainPublicationConflict(record.publicationId, error)
          } catch (storageError) {
            console.error(
              `[collaboration] publication ${record.publicationId} conflict retention failed:`,
              storageError
            )
          }
          console.error(
            `[collaboration] publication ${record.publicationId} was rejected:`,
            error
          )
          this.emitOutcome({
            direction: 'local',
            status: 'send-failed',
            publicationId: record.publicationId,
            error
          })
          continue
        }
        console.error(
          `[collaboration] publication ${record.publicationId} send failed:`,
          error
        )
        this.emitOutcome({
          direction: 'local',
          status: 'send-failed',
          publicationId: record.publicationId,
          error
        })
        if (
          error instanceof ProviderFailure &&
          (error.code === 'not-connected' ||
            error.code === 'connection-failed' ||
            error.code === 'transport-failed')
        ) {
          this.enterDisconnectedEpoch()
          this.scheduleReconnect()
        }
        return
      }
    }
  }

  private async retainPublicationConflict(
    publicationId: string,
    error: unknown
  ): Promise<void> {
    await this.outbox.retainConflict(
      publicationId,
      error instanceof Error ? error.message : String(error)
    )
  }

  private attemptReconnect(): Promise<void> {
    if (this.reconnectPromise) return this.reconnectPromise
    if (this.disposed) return Promise.resolve()
    this.reconciling = true
    this.setState({
      connection: 'retrying',
      sync: 'reconciling'
    })
    const reconnecting = (async () => {
      let next: PreparedSocketComposition | undefined
      try {
        await this.operationQueue
        await this.releaseCurrentComposition()
        next = await this.openSocketComposition()
        await this.operationQueue
        const recoveryCutoff = this.outbox.getLastAppendOrder()
        core.load(next.bootstrap.checkpoint)
        this.recoveryApplyCutoff = recoveryCutoff
        this.recoveryAppliedPublicationIds.clear()
        await this.activateComposition(next)
        next = undefined
        this.reconciling = false
        this.setConnected()
        await this.schedule(() => this.drainOutbox())
      } catch (error) {
        await next?.composition.collaboration.dispose().catch(() => undefined)
        console.error('[collaboration] reconnect attempt failed:', error)
        this.reconciling = false
        this.enterDisconnectedEpoch()
      } finally {
        this.reconnectPromise = undefined
        if (!this.disposed && this.state.connection !== 'connected') {
          this.scheduleReconnect()
        }
      }
    })()
    this.reconnectPromise = reconnecting
    return reconnecting
  }

  private scheduleReconnect(): void {
    if (
      !this.activated ||
      this.disposed ||
      this.reconnectTimer ||
      this.reconnectPromise ||
      this.state.connection === 'connected'
    ) {
      return
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      void this.attemptReconnect()
    }, RECONNECT_INTERVAL_MS)
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
  }

  private enterDisconnectedEpoch(): void {
    if (!this.disconnectedEpochActive) {
      this.disconnectedEpochActive = true
      this.disconnectedEpoch += 1
      this.setState({
        connection: 'disconnected',
        disconnectedEpoch: this.disconnectedEpoch,
        notification: Object.freeze({
          id: `collaboration-disconnected-${this.disconnectedEpoch}`,
          message:
            'The document session is offline. Local editing remains available and changes will sync after reconnection.',
          type: 'disconnected'
        })
      })
      return
    }
    this.setState({
      connection: 'disconnected',
      disconnectedEpoch: this.disconnectedEpoch
    })
  }

  private setConnected(): void {
    const recovered = this.disconnectedEpochActive
    this.disconnectedEpochActive = false
    this.clearReconnectTimer()
    const notification = recovered
      ? Object.freeze({
          id: `collaboration-reconnected-${this.disconnectedEpoch}`,
          message: 'The document session is connected and changes are syncing.',
          type: 'reconnected' as const
        })
      : undefined
    this.setState({
      connection: 'connected',
      ...(notification ? { notification } : {})
    })
    this.applyOutboxState(this.outbox.getState())
  }

  private applyOutboxState(outboxState: PublicationOutboxState): void {
    let sync: CollaborationSyncState = outboxState.status
    if (this.reconciling) sync = 'reconciling'
    let notification = this.state.notification
    if (
      outboxState.status === 'storage-failed' &&
      !this.storageFailureReported
    ) {
      this.storageFailureReported = true
      notification = Object.freeze({
        id: `collaboration-storage-failed-${this.disconnectedEpoch}`,
        message:
          'Local recovery storage is unavailable. Keep this tab open while changes remain pending.',
        type: 'storage-failed'
      })
    } else if (outboxState.status === 'conflicted' && !this.conflictReported) {
      this.conflictReported = true
      notification = Object.freeze({
        id: `collaboration-conflicted-${this.disconnectedEpoch}`,
        message:
          'One or more offline changes need review and remain retained locally.',
        type: 'conflicted'
      })
    }
    this.setState({
      sync,
      pendingCount: outboxState.pendingCount,
      ...(notification ? { notification } : {})
    })
  }

  private setState(update: Partial<CollaborationSessionState>): void {
    const previousStatus = this.getStatus()
    const next = Object.freeze({
      ...this.state,
      ...update
    })
    this.state = next
    const nextStatus = this.getStatus()
    if (nextStatus !== previousStatus) {
      ;[...this.statusSubscribers].forEach((subscriber) => {
        try {
          subscriber(nextStatus)
        } catch {
          // Status observers cannot alter the session owner.
        }
      })
    }
    ;[...this.sessionStateSubscribers].forEach((subscriber) => {
      try {
        subscriber(next)
      } catch {
        // State observers cannot alter the session owner.
      }
    })
  }

  private emitOutcome(outcome: CollaborationPublicationOutcome): void {
    const immutable = Object.freeze({ ...outcome })
    ;[...this.outcomeSubscribers].forEach((subscriber) => {
      try {
        subscriber(immutable)
      } catch {
        // Outcome observers cannot alter publication settlement.
      }
    })
  }
}

let activeController: CollaborationSessionController | undefined
let activeHandle: CollaborationDebugHandle | undefined
let startPromise: Promise<CollaborationDebugHandle> | undefined

export const getActiveCollaborationHandle = ():
  | CollaborationDebugHandle
  | undefined => activeHandle

export const prepareCollaborationDocumentSession = async (
  mode: CollaborationMode
): Promise<PreparedCollaborationDocumentSession> => {
  idCounter.setNamespace(mode.actorId)
  const applyRemotePublication = createPublicationProcessor({
    runRemoteTransaction: factory.runRemoteTransaction.bind(factory),
    decideRemotePublication: (publication) => publication,
    applyCanonicalChanges: core.applyCanonicalChanges.bind(core)
  })
  const processRemotePublication = createRemotePublicationHandler(
    applyRemotePublication
  )
  const controller = new CollaborationSessionController(
    mode,
    processRemotePublication
  )
  activeController = controller
  let activationPromise: Promise<CollaborationDebugHandle> | undefined

  try {
    const bootstrap = await controller.prepare()
    return {
      bootstrap,
      activate: () => {
        activationPromise ??= controller.activate().catch(async (error) => {
          await controller.dispose().catch(() => undefined)
          if (activeController === controller) {
            activeController = undefined
            activeHandle = undefined
          }
          delete window.__Collaboration__
          throw error
        })
        return activationPromise
      }
    }
  } catch (error) {
    await controller.dispose().catch(() => undefined)
    if (activeController === controller) {
      activeController = undefined
      activeHandle = undefined
    }
    delete window.__Collaboration__
    throw error
  }
}

export const startCollaboration = (
  mode: CollaborationMode
): Promise<CollaborationDebugHandle> => {
  if (startPromise) return startPromise
  const pendingStart = prepareCollaborationDocumentSession(mode)
    .then((prepared) => prepared.activate())
    .catch((error) => {
      startPromise = undefined
      throw error
    })
  startPromise = pendingStart
  return pendingStart
}

export const disposeCollaboration = async (): Promise<void> => {
  const controller = activeController
  activeController = undefined
  activeHandle = undefined
  startPromise = undefined
  delete window.__Collaboration__
  await controller?.dispose()
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => void disposeCollaboration())
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_COLLABORATION_WS_URL?: string
  }
}
