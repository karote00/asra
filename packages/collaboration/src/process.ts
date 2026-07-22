import { cloneSharedPublication, type SharedPublication } from '@asyra/factory'
import { Awareness, type AwarenessStateInput } from './awareness'
import type {
  CollaborationFactory,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap,
  CreateCollaborationInput,
  ProcessRemotePublication
} from './composition'
import type {
  InboundPublication,
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
    this.addDisposer(
      this.provider.onPublication((inbound) => {
        this.scheduleInbound(inbound)
      })
    )
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
    const detached = cloneSharedPublication(publication)
    this.outboundQueue = this.outboundQueue.then(async () => {
      if (this.disposed) return
      if (!this.provider) {
        this.emitOutcome({
          direction: 'local',
          status: 'skipped',
          publicationId: detached.publicationId
        })
        return
      }
      try {
        await this.provider.sendPublication(detached)
        this.emitOutcome({
          direction: 'local',
          status: 'sent',
          publicationId: detached.publicationId
        })
      } catch (error) {
        this.emitOutcome({
          direction: 'local',
          status: 'send-failed',
          publicationId: detached.publicationId,
          error
        })
      }
    })
  }

  private scheduleInbound(inbound: InboundPublication): void {
    if (this.disposed) return
    const publication = cloneSharedPublication(inbound.publication)
    const context = Object.freeze({
      ...(inbound.fromActorId ? { fromActorId: inbound.fromActorId } : {})
    })
    this.inboundQueue = this.inboundQueue.then(async () => {
      if (this.disposed) return
      try {
        await this.processRemotePublication(publication, context)
        this.emitOutcome({
          direction: 'remote',
          status: 'processed',
          publicationId: publication.publicationId,
          ...context
        })
      } catch (error) {
        this.emitOutcome({
          direction: 'remote',
          status: 'process-failed',
          publicationId: publication.publicationId,
          ...context,
          error
        })
      }
    })
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
