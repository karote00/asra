import type { SharedPublication } from '@asyra/factory'

import { Awareness, type AwarenessStateInput } from './awareness'
import {
  cloneInboundPublications,
  clonePublication,
  clonePublications
} from './cloning'
import type {
  CollaborationFactory,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap,
  CreateCollaborationInput,
  ProcessRemotePublication
} from './composition'
import type {
  InboundPublication,
  InboundPublicationLease,
  Provider,
  ProviderAwarenessMessage
} from './provider'

export class DisposalError extends Error {
  readonly failures: readonly unknown[]

  constructor(failures: readonly unknown[]) {
    super(`Collaboration disposal failed in ${failures.length} cleanup(s)`)
    this.name = 'DisposalError'
    this.failures = Object.freeze([...failures])
  }
}

interface LifecycleResource {
  destroy?: () => void | Promise<void>
  dispose?: () => void | Promise<void>
}

type Definition = Readonly<
  Omit<CreateCollaborationInput, 'resourceOwnership'> & {
    resourceOwnership: Readonly<CollaborationResourceOwnershipMap>
  }
>

// Keep transport serialization and acknowledgement bounded without splitting a
// canonical publication. High-detail profiling showed that one unbounded
// 50-plus-publication request held its acknowledgement for more than 50 s.
const MAX_PUBLICATIONS_PER_TRANSPORT_BATCH = 4
const MAX_CONCURRENT_PUBLICATION_SENDS = 16

export type CollaborationPublicationOutcome =
  | Readonly<{
      direction: 'local'
      status: 'sent' | 'skipped'
      publicationId: string
    }>
  | Readonly<{
      direction: 'local'
      status: 'send-failed'
      publicationId: string
      error: unknown
    }>
  | Readonly<{
      direction: 'remote'
      status: 'processed'
      publicationId: string
      fromActorId?: string
    }>
  | Readonly<{
      direction: 'remote'
      status: 'process-failed'
      publicationId: string
      fromActorId?: string
      error: unknown
    }>

const callLifecycle = async (
  resource: LifecycleResource | undefined
): Promise<void> => {
  if (!resource) return
  if (typeof resource.destroy === 'function') {
    await resource.destroy()
    return
  }
  if (typeof resource.dispose === 'function') await resource.dispose()
}

const requireIdentity = (name: string, value: string): string => {
  if (!value.trim()) throw new Error(`[collaboration] ${name} is required`)
  return value
}

const resolveOwnership = (
  name: keyof CollaborationResourceOwnershipMap,
  injected: boolean,
  requested?: CollaborationResourceOwnership
): CollaborationResourceOwnership => {
  if (requested && requested !== 'owned' && requested !== 'borrowed') {
    throw new Error(
      `[collaboration] resourceOwnership.${name} must be owned or borrowed`
    )
  }
  if (requested) return requested
  return name === 'awareness' && !injected ? 'owned' : 'borrowed'
}

const define = (input: CreateCollaborationInput): Definition => {
  const documentId = requireIdentity('documentId', input.documentId)
  const roomId = requireIdentity('roomId', input.roomId)
  const actorId = requireIdentity('actorId', input.actorId)
  if (typeof input.factory?.subscribeToSharedPublication !== 'function') {
    throw new Error(
      '[collaboration] factory.subscribeToSharedPublication is required'
    )
  }
  if (typeof input.processRemotePublication !== 'function') {
    throw new Error('[collaboration] processRemotePublication is required')
  }
  return Object.freeze({
    documentId,
    roomId,
    actorId,
    factory: input.factory,
    processRemotePublication: input.processRemotePublication,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.awareness ? { awareness: input.awareness } : {}),
    resourceOwnership: Object.freeze({
      provider: resolveOwnership(
        'provider',
        input.provider !== undefined,
        input.resourceOwnership?.provider
      ),
      awareness: resolveOwnership(
        'awareness',
        input.awareness !== undefined,
        input.resourceOwnership?.awareness
      )
    })
  })
}

const assertProviderIdentity = (
  provider: Provider | undefined,
  identity: Collaboration['identity']
): void => {
  if (!provider) return
  if (
    provider.identity.documentId !== identity.documentId ||
    provider.identity.roomId !== identity.roomId ||
    provider.identity.actorId !== identity.actorId
  ) {
    throw new Error(
      '[collaboration] provider identity must match collaboration'
    )
  }
}

export class Collaboration {
  readonly identity: Readonly<{
    documentId: string
    roomId: string
    actorId: string
  }>
  readonly factory: CollaborationFactory
  readonly provider?: Provider
  readonly awareness: Awareness

  private readonly composition: Definition
  private readonly processRemotePublication: ProcessRemotePublication
  private readonly disposers: (() => void | Promise<void>)[] = []
  private readonly outcomeSubscribers = new Set<
    (outcome: CollaborationPublicationOutcome) => void
  >()
  private outboundQueue: Promise<void> = Promise.resolve()
  private readonly pendingOutboundPublications: SharedPublication[] = []
  private readonly settledOutboundBatches = new Map<
    number,
    readonly CollaborationPublicationOutcome[]
  >()
  private outboundIdleResolve: (() => void) | undefined
  private outboundPumpScheduled = false
  private outboundInFlight = 0
  private outboundBatchSequence = 0
  private nextOutboundOutcomeSequence = 1
  private inboundQueue: Promise<void> = Promise.resolve()
  private observersBound = false
  private started = false
  private disposed = false
  private startPromise: Promise<void> | null = null
  private disposePromise: Promise<void> | null = null

  constructor(input: CreateCollaborationInput) {
    const composition = define(input)
    this.composition = composition
    this.identity = Object.freeze({
      documentId: composition.documentId,
      roomId: composition.roomId,
      actorId: composition.actorId
    })
    this.factory = composition.factory
    this.provider = composition.provider
    assertProviderIdentity(this.provider, this.identity)
    this.awareness =
      composition.awareness ?? new Awareness({ actorId: composition.actorId })
    this.processRemotePublication = composition.processRemotePublication
  }

  start(): Promise<void> {
    this.requireUsable()
    if (this.startPromise) return this.startPromise
    this.startPromise = this.activate().catch((error) => {
      this.startPromise = null
      throw error
    })
    return this.startPromise
  }

  async disconnect(): Promise<void> {
    this.requireUsable()
    try {
      await this.provider?.disconnect()
    } finally {
      this.awareness.clearRemote('disconnect')
    }
  }

  async reconnect(): Promise<void> {
    this.requireUsable()
    if (!this.provider) return
    if (!this.observersBound) {
      await this.start()
      return
    }
    await this.provider.reconnect()
    if (!this.disposed) this.started = true
  }

  async updateAwareness(
    state: AwarenessStateInput
  ): Promise<ProviderAwarenessMessage> {
    this.requireUsable()
    const message = this.awareness.updateLocal(state)
    await this.provider?.sendAwareness(message)
    return message
  }

  async leaveAwareness(): Promise<ProviderAwarenessMessage> {
    this.requireUsable()
    const message = this.awareness.leaveLocal()
    await this.provider?.sendAwareness(message)
    return message
  }

  expireAwareness(): readonly string[] {
    this.requireUsable()
    return this.awareness.expire()
  }

  observePublicationOutcomes(
    subscriber: (outcome: CollaborationPublicationOutcome) => void
  ): () => void {
    this.requireUsable()
    this.outcomeSubscribers.add(subscriber)
    return () => this.outcomeSubscribers.delete(subscriber)
  }

  isStarted(): boolean {
    return this.started
  }

  isDisposed(): boolean {
    return this.disposed
  }

  async whenIdle(): Promise<void> {
    let outbound: Promise<void>
    let inbound: Promise<void>
    do {
      outbound = this.outboundQueue
      inbound = this.inboundQueue
      await Promise.all([outbound, inbound])
    } while (outbound !== this.outboundQueue || inbound !== this.inboundQueue)
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposed = true
    this.disposePromise = this.disposeOwnedResources()
    return this.disposePromise
  }

  private async activate(): Promise<void> {
    this.bindObservers()
    if (this.provider) await this.provider.connect()
    if (!this.disposed) this.started = true
  }

  private bindObservers(): void {
    if (this.observersBound) return
    this.observersBound = true
    this.addDisposer(
      this.factory.subscribeToSharedPublication((publication) => {
        this.scheduleOutbound(publication)
      })
    )
    if (!this.provider) return
    if (this.provider.onInboundPublicationLease) {
      this.addDisposer(
        this.provider.onInboundPublicationLease((lease) => {
          this.scheduleInboundLease(lease)
        })
      )
    } else if (this.provider.onPublications) {
      this.addDisposer(
        this.provider.onPublications((publications) => {
          this.scheduleInboundBatch(publications)
        })
      )
    } else {
      this.addDisposer(
        this.provider.onPublication((inbound) => {
          this.scheduleInbound(inbound)
        })
      )
    }
    this.addDisposer(
      this.provider.onAwareness((message) => {
        if (!this.disposed) this.awareness.applyRemote(message)
      })
    )
    this.addDisposer(
      this.provider.onAwarenessDisconnect((event) => {
        if (!this.disposed) this.awareness.handleDisconnect(event)
      })
    )
    this.addDisposer(
      this.provider.onStatusChange((status) => {
        if (status === 'disconnected' || status === 'failed') {
          this.awareness.clearRemote('disconnect')
        }
      })
    )
  }

  private addDisposer(disposer: () => void | Promise<void>): void {
    this.disposers.push(disposer)
  }

  private scheduleOutbound(publication: SharedPublication): void {
    if (this.disposed) return
    this.pendingOutboundPublications.push(publication)
    this.ensureOutboundIdleBoundary()
    this.scheduleOutboundPump()
  }

  private ensureOutboundIdleBoundary(): void {
    if (this.outboundIdleResolve) return
    this.outboundQueue = new Promise<void>((resolve) => {
      this.outboundIdleResolve = resolve
    })
  }

  private scheduleOutboundPump(): void {
    if (this.outboundPumpScheduled) return
    this.outboundPumpScheduled = true
    queueMicrotask(() => {
      this.outboundPumpScheduled = false
      this.pumpOutboundPublications()
    })
  }

  private pumpOutboundPublications(): void {
    if (this.disposed) {
      this.pendingOutboundPublications.length = 0
      this.settleOutboundIdleBoundary()
      return
    }
    const providerSendWindow = this.provider?.maxConcurrentPublicationSends
    const requestedWindow =
      this.provider?.sendPublications &&
      typeof providerSendWindow === 'number' &&
      Number.isInteger(providerSendWindow) &&
      providerSendWindow > 0
        ? providerSendWindow
        : 1
    const sendWindow = Math.min(
      requestedWindow,
      MAX_CONCURRENT_PUBLICATION_SENDS
    )
    const providerBatchSize = this.provider?.maxPublicationsPerSend
    const requestedBatchSize =
      this.provider?.sendPublications &&
      typeof providerBatchSize === 'number' &&
      Number.isInteger(providerBatchSize) &&
      providerBatchSize > 0
        ? providerBatchSize
        : MAX_PUBLICATIONS_PER_TRANSPORT_BATCH
    const publicationBatchSize = this.provider?.sendPublications
      ? Math.min(requestedBatchSize, MAX_PUBLICATIONS_PER_TRANSPORT_BATCH)
      : 1

    while (
      this.outboundInFlight < sendWindow &&
      this.pendingOutboundPublications.length > 0
    ) {
      const pendingBatch = this.pendingOutboundPublications.splice(
        0,
        publicationBatchSize
      )
      const sequence = ++this.outboundBatchSequence
      let detached: readonly SharedPublication[]
      try {
        detached = clonePublications(pendingBatch)
      } catch (error) {
        this.settledOutboundBatches.set(
          sequence,
          pendingBatch.map((publication) => ({
            direction: 'local',
            status: 'send-failed',
            publicationId: publication.publicationId,
            error
          }))
        )
        this.flushSettledOutboundOutcomes()
        continue
      }
      this.outboundInFlight += 1
      void this.dispatchOutboundPublications(detached).then((outcomes) => {
        this.settledOutboundBatches.set(sequence, outcomes)
        this.outboundInFlight -= 1
        this.flushSettledOutboundOutcomes()
        this.pumpOutboundPublications()
      })
    }
    this.settleOutboundIdleBoundary()
  }

  private async dispatchOutboundPublications(
    publications: readonly SharedPublication[]
  ): Promise<readonly CollaborationPublicationOutcome[]> {
    if (!this.provider) {
      return publications.map((publication) => ({
        direction: 'local',
        status: 'skipped',
        publicationId: publication.publicationId
      }))
    }
    if (publications.length > 1 && this.provider.sendPublications) {
      try {
        await this.provider.sendPublications(publications)
        return publications.map((publication) => ({
          direction: 'local',
          status: 'sent',
          publicationId: publication.publicationId
        }))
      } catch (error) {
        return publications.map((publication) => ({
          direction: 'local',
          status: 'send-failed',
          publicationId: publication.publicationId,
          error
        }))
      }
    }
    const outcomes: CollaborationPublicationOutcome[] = []
    for (const publication of publications) {
      try {
        await this.provider.sendPublication(publication)
        outcomes.push({
          direction: 'local',
          status: 'sent',
          publicationId: publication.publicationId
        })
      } catch (error) {
        outcomes.push({
          direction: 'local',
          status: 'send-failed',
          publicationId: publication.publicationId,
          error
        })
      }
    }
    return outcomes
  }

  private flushSettledOutboundOutcomes(): void {
    let outcomes = this.settledOutboundBatches.get(
      this.nextOutboundOutcomeSequence
    )
    while (outcomes) {
      this.settledOutboundBatches.delete(this.nextOutboundOutcomeSequence)
      outcomes.forEach((outcome) => this.emitOutcome(outcome))
      this.nextOutboundOutcomeSequence += 1
      outcomes = this.settledOutboundBatches.get(
        this.nextOutboundOutcomeSequence
      )
    }
  }

  private settleOutboundIdleBoundary(): void {
    if (
      this.pendingOutboundPublications.length > 0 ||
      this.outboundInFlight > 0 ||
      this.settledOutboundBatches.size > 0 ||
      this.outboundPumpScheduled
    ) {
      return
    }
    const resolve = this.outboundIdleResolve
    this.outboundIdleResolve = undefined
    resolve?.()
  }

  private scheduleInbound(inbound: InboundPublication): void {
    this.scheduleInboundBatch([
      Object.freeze({
        publication: clonePublication(inbound.publication),
        ...(inbound.fromActorId ? { fromActorId: inbound.fromActorId } : {})
      })
    ])
  }

  private scheduleInboundBatch(
    inboundPublications: readonly InboundPublication[]
  ): void {
    if (this.disposed || inboundPublications.length === 0) return
    const detached = cloneInboundPublications(inboundPublications)
    this.inboundQueue = this.inboundQueue.then(async () => {
      if (this.disposed) return
      for (const inbound of detached) {
        await this.processInboundPublication(inbound)
      }
    })
  }

  private scheduleInboundLease(lease: InboundPublicationLease): void {
    if (this.disposed) {
      lease.settle({
        outcome: 'terminal-failure',
        error: new Error('[collaboration] collaboration is disposed')
      })
      return
    }
    this.inboundQueue = this.inboundQueue.then(async () => {
      if (this.disposed) {
        lease.settle({
          outcome: 'terminal-failure',
          error: new Error('[collaboration] collaboration is disposed')
        })
        return
      }
      await this.processInboundPublication(lease, lease)
    })
  }

  private async processInboundPublication(
    inbound: InboundPublication,
    lease?: InboundPublicationLease
  ): Promise<void> {
    const context = Object.freeze({
      ...(inbound.fromActorId ? { fromActorId: inbound.fromActorId } : {})
    })
    try {
      await this.processRemotePublication(inbound.publication, context)
      this.emitOutcome({
        direction: 'remote',
        status: 'processed',
        publicationId: inbound.publication.publicationId,
        ...context
      })
      lease?.settle({ outcome: 'success' })
    } catch (error) {
      this.emitOutcome({
        direction: 'remote',
        status: 'process-failed',
        publicationId: inbound.publication.publicationId,
        ...context,
        error
      })
      lease?.settle({ outcome: 'terminal-failure', error })
    }
  }

  private emitOutcome(outcome: CollaborationPublicationOutcome): void {
    const immutable = Object.freeze({ ...outcome })
    ;[...this.outcomeSubscribers].forEach((subscriber) => {
      try {
        subscriber(immutable)
      } catch {
        // Observers cannot alter collaboration settlement.
      }
    })
  }

  private async disposeOwnedResources(): Promise<void> {
    const failures: unknown[] = []
    const attempt = async (cleanup: () => void | Promise<void>) => {
      try {
        await cleanup()
      } catch (error) {
        failures.push(error)
      }
    }

    for (const disposer of [...this.disposers].reverse()) {
      await attempt(disposer)
    }
    this.disposers.length = 0
    this.outcomeSubscribers.clear()

    if (this.composition.resourceOwnership.provider === 'owned') {
      await attempt(() => callLifecycle(this.provider))
    }
    if (this.startPromise) await this.startPromise.catch(() => undefined)
    await this.whenIdle()
    if (this.composition.resourceOwnership.awareness === 'owned') {
      await attempt(() => callLifecycle(this.awareness))
    }

    if (failures.length > 0) throw new DisposalError(failures)
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new Error('[collaboration] collaboration is disposed')
    }
  }
}

export const createCollaboration = (
  input: CreateCollaborationInput
): Collaboration => new Collaboration(input)
