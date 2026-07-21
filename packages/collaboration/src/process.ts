import type { Factory, SharedPublication } from '@asyra/factory'
import * as Y from 'yjs'
import { Awareness, type AwarenessStateInput } from './awareness'
import {
  createConflictPolicy,
  type AppConflictPolicy,
  type ConflictOutcome
} from './operations/conflict'
import { applyOperation, type OperationApplyOutcome } from './operations/apply'
import {
  createOperationIdentitySource,
  createSharedOperationEnvelope,
  type SharedOperationEnvelope
} from './operations/envelope'
import { OperationOutcomeRegistry } from './operations/outcomes'
import { OperationRegistry } from './operations/registry'
import {
  validateRemoteOperation,
  type RemoteValidationResult
} from './operations/validation'
import {
  Durability,
  type DurabilityEvent,
  type DurabilityOutcome
} from './durability'
import type { UpdatePersistence } from './persistence'
import type {
  Provider,
  InboundBinaryUpdate,
  ProviderAwarenessMessage
} from './provider'
import type {
  CollaborationFactory,
  CollaborationOperationDefinition,
  CollaborationPermissionPolicy,
  CollaborationResourceOwnership,
  CollaborationResourceOwnershipMap,
  CreateCollaborationInput
} from './composition'
import {
  appendOperationsToYDoc,
  applyInboundYjsUpdate,
  type InboundYjsUpdateSource
} from './yjs-document'

export class DisposalError extends Error {
  readonly failures: readonly unknown[]

  constructor(failures: readonly unknown[]) {
    super(`Collaboration disposal failed in ${failures.length} cleanup(s)`)
    this.name = 'DisposalError'
    this.failures = Object.freeze([...failures])
  }
}

type Definition = Readonly<
  Omit<
    CreateCollaborationInput,
    'operationDefinitions' | 'conflictPolicies' | 'resourceOwnership'
  > & {
    operationDefinitions: readonly CollaborationOperationDefinition[]
    conflictPolicies?: readonly AppConflictPolicy[]
    resourceOwnership: Readonly<CollaborationResourceOwnershipMap>
  }
>

interface LifecycleResource {
  destroy?: () => void | Promise<void>
  dispose?: () => void | Promise<void>
}

export interface LocalPublishedOperationOutcome {
  readonly direction: 'local'
  readonly status: 'published'
  readonly envelope: SharedOperationEnvelope
  readonly durability: DurabilityOutcome
}

export interface LocalRejectedOperationOutcome {
  readonly direction: 'local'
  readonly status: 'rejected'
  readonly error: unknown
}

export interface RemoteProcessedOperationOutcome {
  readonly direction: 'remote'
  readonly source: InboundYjsUpdateSource
  readonly outcome:
    | RemoteValidationResult
    | ConflictOutcome
    | OperationApplyOutcome
}

export interface RemoteFailedOperationOutcome {
  readonly direction: 'remote'
  readonly source: InboundYjsUpdateSource
  readonly status: 'decode-failed' | 'runtime-failed'
  readonly error: unknown
}

export type CollaborationOperationOutcome =
  | LocalPublishedOperationOutcome
  | LocalRejectedOperationOutcome
  | RemoteProcessedOperationOutcome
  | RemoteFailedOperationOutcome

const callLifecycle = async (
  resource: LifecycleResource | undefined
): Promise<void> => {
  if (!resource) return
  if (typeof resource.destroy === 'function') {
    await resource.destroy()
    return
  }
  if (typeof resource.dispose === 'function') {
    await resource.dispose()
  }
}

const requireIdentity = (name: string, value: string): string => {
  if (!value.trim()) {
    throw new Error(`[collaboration] ${name} is required`)
  }
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
  if (name === 'yDoc' || name === 'awareness') {
    return injected ? 'borrowed' : 'owned'
  }
  return 'borrowed'
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
  if (!Array.isArray(input.operationDefinitions)) {
    throw new Error('[collaboration] operationDefinitions must be an array')
  }
  if (typeof input.permissionPolicy !== 'function') {
    throw new Error('[collaboration] permissionPolicy is required')
  }

  const resourceOwnership = Object.freeze({
    provider: resolveOwnership(
      'provider',
      input.provider !== undefined,
      input.resourceOwnership?.provider
    ),
    yDoc: resolveOwnership(
      'yDoc',
      input.yDoc !== undefined,
      input.resourceOwnership?.yDoc
    ),
    awareness: resolveOwnership(
      'awareness',
      input.awareness !== undefined,
      input.resourceOwnership?.awareness
    ),
    persistence: resolveOwnership(
      'persistence',
      input.persistence !== undefined,
      input.resourceOwnership?.persistence
    )
  })

  return Object.freeze({
    documentId,
    roomId,
    actorId,
    factory: input.factory,
    operationDefinitions: Object.freeze([...input.operationDefinitions]),
    permissionPolicy: input.permissionPolicy,
    ...(input.provider !== undefined ? { provider: input.provider } : {}),
    ...(input.yDoc !== undefined ? { yDoc: input.yDoc } : {}),
    ...(input.awareness !== undefined ? { awareness: input.awareness } : {}),
    ...(input.persistence !== undefined
      ? { persistence: input.persistence }
      : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    ...(input.conflictPolicies !== undefined
      ? { conflictPolicies: Object.freeze([...input.conflictPolicies]) }
      : {}),
    resourceOwnership
  })
}

const requireSessionId = (value: string): string => {
  if (!value.trim()) {
    throw new Error('[collaboration] sessionId is required when supplied')
  }
  return value
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
  readonly yDoc: Y.Doc
  readonly provider?: Provider
  readonly awareness: Awareness
  readonly persistence?: UpdatePersistence
  readonly operationDefinitions: readonly CollaborationOperationDefinition[]
  readonly permissionPolicy: CollaborationPermissionPolicy

  private readonly composition: Definition
  private readonly operationRegistry: OperationRegistry
  private readonly operationOutcomes = new OperationOutcomeRegistry()
  private readonly identitySource
  private readonly conflictPolicy
  private readonly durability: Durability
  private readonly disposers: (() => void | Promise<void>)[] = []
  private readonly outcomeSubscribers = new Set<
    (outcome: CollaborationOperationOutcome) => void
  >()
  private workQueue: Promise<void> = Promise.resolve()
  private observersBound = false
  private started = false
  private disposed = false
  private startPromise: Promise<void> | null = null
  private disposePromise: Promise<void> | null = null

  constructor(input: CreateCollaborationInput) {
    const composition = define(input)
    if (
      composition.yDoc !== undefined &&
      !(composition.yDoc instanceof Y.Doc)
    ) {
      throw new Error('[collaboration] yDoc must be a Y.Doc')
    }
    this.composition = composition
    this.identity = Object.freeze({
      documentId: composition.documentId,
      roomId: composition.roomId,
      actorId: composition.actorId
    })
    this.factory = composition.factory
    this.yDoc = composition.yDoc ?? new Y.Doc()
    this.provider = composition.provider
    assertProviderIdentity(this.provider, this.identity)
    this.awareness =
      composition.awareness ?? new Awareness({ actorId: composition.actorId })
    this.persistence = composition.persistence
    this.operationDefinitions = composition.operationDefinitions
    this.permissionPolicy = composition.permissionPolicy
    if (
      this.operationDefinitions.length > 0 &&
      (typeof this.factory.runRemoteTransaction !== 'function' ||
        typeof this.factory.isRemoteAsyncHandlerError !== 'function')
    ) {
      throw new Error(
        '[collaboration] operation-enabled Factory requires the remote transaction boundary'
      )
    }
    this.operationRegistry = new OperationRegistry(this.operationDefinitions)
    this.operationDefinitions.forEach((definition) => {
      if (typeof definition.apply !== 'function') {
        throw new Error(
          '[collaboration] every operation definition requires a canonical apply handler'
        )
      }
    })
    this.identitySource = createOperationIdentitySource(
      requireSessionId(
        composition.sessionId ?? `yjs-${this.yDoc.clientID.toString(36)}`
      )
    )
    this.conflictPolicy = createConflictPolicy({
      operationRegistry: this.operationRegistry,
      permissionPolicy: this.permissionPolicy,
      appPolicies: composition.conflictPolicies
    })
    this.durability = new Durability({
      document: this.yDoc,
      documentId: this.identity.documentId,
      persistence: this.persistence,
      provider: this.provider
    })
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
    if (this.disposed) return
    await this.synchronizeProviderOperations()
    if (this.disposed) return
    this.started = true
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

  observeOperationOutcomes(
    subscriber: (outcome: CollaborationOperationOutcome) => void
  ): () => void {
    this.requireUsable()
    this.outcomeSubscribers.add(subscriber)
    return () => this.outcomeSubscribers.delete(subscriber)
  }

  observeDurability(subscriber: (event: DurabilityEvent) => void): () => void {
    this.requireUsable()
    return this.durability.observe(subscriber)
  }

  private addDisposer(disposer: () => void | Promise<void>): () => void {
    this.requireUsable()
    this.disposers.push(disposer)
    return disposer
  }

  isStarted(): boolean {
    return this.started
  }

  isDisposed(): boolean {
    return this.disposed
  }

  async whenIdle(): Promise<void> {
    let pending: Promise<void>
    do {
      pending = this.workQueue
      await pending
    } while (pending !== this.workQueue)
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise
    this.disposed = true
    this.disposePromise = this.disposeOwnedResources()
    return this.disposePromise
  }

  private async activate(): Promise<void> {
    this.bindObservers()
    this.durability.start()
    const recovered = await this.durability.recoverFromPersistence()
    if (this.disposed) return
    await this.processOperations(recovered, 'persistence')
    if (this.disposed) return
    if (this.provider) {
      await this.provider.connect()
      if (this.disposed) return
      await this.synchronizeProviderOperations()
      if (this.disposed) return
    }
    this.started = true
  }

  private bindObservers(): void {
    if (this.observersBound) return
    this.observersBound = true
    this.addDisposer(
      this.factory.subscribeToSharedPublication((publication) => {
        this.schedule(() => this.processPublication(publication))
      })
    )
    if (!this.provider) return
    this.addDisposer(
      this.provider.onUpdate((update) => {
        this.schedule(() => this.processInboundUpdate(update))
      })
    )
    this.addDisposer(
      this.provider.onAwareness((message) => {
        this.schedule(() => {
          this.awareness.applyRemote(message)
        })
      })
    )
    this.addDisposer(
      this.provider.onAwarenessDisconnect((event) => {
        this.schedule(() => {
          this.awareness.handleDisconnect(event)
        })
      })
    )
    this.addDisposer(
      this.provider.onStatusChange((status) => {
        if (status !== 'disconnected' && status !== 'failed') return
        this.schedule(() => {
          this.awareness.clearRemote('disconnect')
        })
      })
    )
  }

  private schedule(task: () => void | Promise<void>): void {
    if (this.disposed) return
    this.workQueue = this.workQueue
      .then(async () => {
        if (this.disposed) return
        await task()
      })
      .catch((error) => {
        this.emitOutcome({
          direction: 'remote',
          source: 'provider',
          status: 'runtime-failed',
          error
        })
      })
  }

  private async processPublication(
    publication: SharedPublication
  ): Promise<void> {
    try {
      const envelopes = publication.deliveries.map((delivery) =>
        createSharedOperationEnvelope({
          delivery,
          identity: this.identity,
          identitySource: this.identitySource,
          registry: this.operationRegistry
        })
      )
      const publicationId = this.identitySource.operationId(
        this.identity.actorId,
        publication.publicationId
      )
      const binary = appendOperationsToYDoc(this.yDoc, publicationId, envelopes)
      envelopes.forEach((envelope) =>
        this.operationOutcomes.recordLocal(envelope)
      )
      const durability = await this.durability.settleLocalUpdate(binary)
      envelopes.forEach((envelope) => {
        this.emitOutcome({
          direction: 'local',
          status: 'published',
          envelope,
          durability
        })
      })
    } catch (error) {
      this.emitOutcome({ direction: 'local', status: 'rejected', error })
    }
  }

  private async processInboundUpdate(
    update: InboundBinaryUpdate
  ): Promise<void> {
    let operations: readonly unknown[]
    try {
      operations = applyInboundYjsUpdate(
        this.yDoc,
        update.update,
        'provider'
      ).operations
    } catch (error) {
      this.emitOutcome({
        direction: 'remote',
        source: 'provider',
        status: 'decode-failed',
        error
      })
      return
    }
    await this.processOperations(operations, 'provider', update.fromActorId)
  }

  private async synchronizeProviderOperations(): Promise<void> {
    const synchronization = await this.durability.synchronizeWithProvider()
    await this.processOperations(synchronization.receivedOperations, 'provider')
  }

  private async processOperations(
    operations: readonly unknown[],
    source: InboundYjsUpdateSource,
    authenticatedActorId?: string
  ): Promise<void> {
    for (const decoded of operations) {
      const validation = validateRemoteOperation({
        decoded,
        documentId: this.identity.documentId,
        authenticatedActorId,
        registry: this.operationRegistry,
        outcomes: this.operationOutcomes
      })
      if (validation.status !== 'validated') {
        this.emitOutcome({ direction: 'remote', source, outcome: validation })
        continue
      }

      const decision = await this.conflictPolicy.decide(validation)
      if (this.disposed) return
      if (decision.status === 'rejected') {
        this.operationOutcomes.record(validation.envelope, {
          status: 'rejected',
          operationId: validation.envelope.operationId,
          applied: false,
          code: `${decision.owner}:${decision.code}`
        })
        this.emitOutcome({ direction: 'remote', source, outcome: decision })
        continue
      }

      const definition = this.operationRegistry.resolve(
        decision.envelope.channel,
        decision.envelope.eventName
      )
      if (!definition?.apply) {
        const error = new Error(
          '[collaboration] canonical apply handler is unavailable'
        )
        this.operationOutcomes.record(validation.envelope, {
          status: 'apply-failed',
          operationId: validation.envelope.operationId,
          applied: false,
          code: 'missing-canonical-apply-handler'
        })
        this.emitOutcome({
          direction: 'remote',
          source,
          status: 'runtime-failed',
          error
        })
        continue
      }

      const outcome = applyOperation({
        operation: decision,
        factory: this.factory as Factory,
        apply: definition.apply,
        outcomes: this.operationOutcomes
      })
      this.emitOutcome({ direction: 'remote', source, outcome })
    }
  }

  private emitOutcome(outcome: CollaborationOperationOutcome): void {
    const immutable = Object.freeze({
      ...outcome
    }) as CollaborationOperationOutcome
    ;[...this.outcomeSubscribers].forEach((subscriber) => {
      try {
        subscriber(immutable)
      } catch {
        // Outcome observers cannot alter collaboration settlement.
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
    this.durability.dispose()
    this.outcomeSubscribers.clear()

    if (this.composition.resourceOwnership.provider === 'owned') {
      await attempt(() => callLifecycle(this.provider))
    }
    if (this.composition.resourceOwnership.persistence === 'owned') {
      await attempt(() => callLifecycle(this.persistence))
    }
    if (this.startPromise) {
      await this.startPromise.catch(() => undefined)
    }
    await this.whenIdle()
    if (this.composition.resourceOwnership.awareness === 'owned') {
      await attempt(() => callLifecycle(this.awareness))
    }
    if (this.composition.resourceOwnership.yDoc === 'owned') {
      await attempt(() => this.yDoc.destroy())
    }

    if (failures.length > 0) {
      throw new DisposalError(failures)
    }
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
