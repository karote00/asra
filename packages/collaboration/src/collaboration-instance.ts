import type { Factory, SharedDelivery } from '@asyra/factory'
import * as Y from 'yjs'
import { AwarenessRuntime, type AwarenessStateInput } from './awareness'
import {
  createConflictPolicyPipeline,
  type ConflictPipelineOutcome
} from './conflict-policy'
import {
  OperationOutcomeRegistry,
  type RemoteCanonicalApplyOutcome,
  type RemoteValidationResult,
  runRemoteCanonicalApply,
  validateRemoteOperation
} from './inbound-pipeline'
import {
  createOperationIdentitySource,
  createSharedOperationEnvelope,
  type SharedOperationEnvelope
} from './operation-envelope'
import { OperationRegistry } from './operation-registry'
import {
  CollaborationDurabilityRuntime,
  type CollaborationDurabilityEvent,
  type CollaborationDurabilityOutcome,
  type CollaborationUpdatePersistence
} from './persistence'
import type {
  CollaborationProvider,
  InboundBinaryUpdate,
  ProviderAwarenessMessage
} from './provider'
import type {
  CollaborationComposition,
  CollaborationInstanceCompositionInput,
  CollaborationLifecycleResource,
  CollaborationOperationDefinition,
  CollaborationPermissionPolicy
} from './types'
import {
  appendOperationToYDoc,
  applyInboundYjsUpdate,
  type InboundYjsUpdateSource
} from './yjs-document'

export class CollaborationDisposalError extends Error {
  readonly failures: readonly unknown[]

  constructor(failures: readonly unknown[]) {
    super(`Collaboration disposal failed in ${failures.length} cleanup(s)`)
    this.name = 'CollaborationDisposalError'
    this.failures = Object.freeze([...failures])
  }
}

type InstanceComposition = CollaborationComposition<
  CollaborationOperationDefinition,
  CollaborationPermissionPolicy,
  CollaborationProvider,
  Y.Doc,
  AwarenessRuntime,
  CollaborationUpdatePersistence
>

export type CollaborationOperationOutcome =
  | Readonly<{
      direction: 'local'
      status: 'published'
      envelope: SharedOperationEnvelope
      durability: CollaborationDurabilityOutcome
    }>
  | Readonly<{
      direction: 'local'
      status: 'rejected'
      error: unknown
    }>
  | Readonly<{
      direction: 'remote'
      source: InboundYjsUpdateSource
      outcome:
        | RemoteValidationResult
        | ConflictPipelineOutcome
        | RemoteCanonicalApplyOutcome
    }>
  | Readonly<{
      direction: 'remote'
      source: InboundYjsUpdateSource
      status: 'decode-failed' | 'runtime-failed'
      error: unknown
    }>

const callLifecycle = async (
  resource: CollaborationLifecycleResource | undefined
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

const requireSessionId = (value: string): string => {
  if (!value.trim()) {
    throw new Error('[collaboration] sessionId is required when supplied')
  }
  return value
}

const assertProviderIdentity = (
  provider: CollaborationProvider | undefined,
  identity: CollaborationInstance['identity']
): void => {
  if (!provider) return
  if (
    provider.identity.documentId !== identity.documentId ||
    provider.identity.roomId !== identity.roomId ||
    provider.identity.actorId !== identity.actorId
  ) {
    throw new Error(
      '[collaboration] provider identity must match the collaboration instance'
    )
  }
}

export class CollaborationInstance {
  readonly identity: Readonly<{
    documentId: string
    roomId: string
    actorId: string
  }>
  readonly factory: InstanceComposition['factory']
  readonly yDoc: Y.Doc
  readonly provider?: CollaborationProvider
  readonly awareness: AwarenessRuntime
  readonly persistence?: CollaborationUpdatePersistence
  readonly operationDefinitions: readonly CollaborationOperationDefinition[]
  readonly permissionPolicy: CollaborationPermissionPolicy

  private readonly composition: InstanceComposition
  private readonly operationRegistry: OperationRegistry
  private readonly operationOutcomes = new OperationOutcomeRegistry()
  private readonly identitySource
  private readonly conflictPolicy
  private readonly durability: CollaborationDurabilityRuntime
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

  constructor(composition: InstanceComposition) {
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
      composition.awareness ??
      new AwarenessRuntime({ actorId: composition.actorId })
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
    this.conflictPolicy = createConflictPolicyPipeline({
      operationRegistry: this.operationRegistry,
      permissionPolicy: this.permissionPolicy,
      frameworkInvariants: composition.frameworkInvariants ?? {},
      appPolicies: composition.conflictPolicies
    })
    this.durability = new CollaborationDurabilityRuntime({
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
    await this.provider?.disconnect()
  }

  async reconnect(): Promise<void> {
    this.requireUsable()
    if (!this.provider) return
    if (!this.observersBound) {
      await this.start()
      return
    }
    await this.provider.reconnect()
    await this.synchronizeProviderOperations()
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

  observeDurability(
    subscriber: (event: CollaborationDurabilityEvent) => void
  ): () => void {
    this.requireUsable()
    return this.durability.observe(subscriber)
  }

  ownDisposer(disposer: () => void | Promise<void>): () => void {
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
    const recovered = await this.durability.recoverFromPersistence()
    if (this.disposed) return
    await this.processRemoteOperations(recovered, 'persistence')
    if (this.provider) {
      await this.provider.connect()
      if (this.disposed) return
      await this.synchronizeProviderOperations()
    }
    this.started = true
  }

  private bindObservers(): void {
    if (this.observersBound) return
    this.observersBound = true
    this.ownDisposer(
      this.factory.subscribeToSharedDelivery((delivery) => {
        this.schedule(() => this.publishLocalDelivery(delivery))
      })
    )
    if (!this.provider) return
    this.ownDisposer(
      this.provider.onUpdate((update) => {
        this.schedule(() => this.processInboundUpdate(update))
      })
    )
    this.ownDisposer(
      this.provider.onAwareness((message) => {
        this.schedule(() => {
          this.awareness.applyRemote(message)
        })
      })
    )
    this.ownDisposer(
      this.provider.onAwarenessDisconnect((event) => {
        this.schedule(() => {
          this.awareness.handleDisconnect(event)
        })
      })
    )
  }

  private schedule(task: () => void | Promise<void>): void {
    if (this.disposed) return
    this.workQueue = this.workQueue.then(task).catch((error) => {
      this.emitOutcome({
        direction: 'remote',
        source: 'provider',
        status: 'runtime-failed',
        error
      })
    })
  }

  private async publishLocalDelivery(delivery: SharedDelivery): Promise<void> {
    try {
      const envelope = createSharedOperationEnvelope({
        delivery,
        identity: this.identity,
        identitySource: this.identitySource,
        registry: this.operationRegistry
      })
      const binary = appendOperationToYDoc(this.yDoc, envelope)
      const durability = await this.durability.settleLocalUpdate(binary)
      this.emitOutcome({
        direction: 'local',
        status: 'published',
        envelope,
        durability
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
    await this.processRemoteOperations(operations, 'provider')
  }

  private async synchronizeProviderOperations(): Promise<void> {
    const synchronization = await this.durability.synchronizeWithProvider()
    await this.processRemoteOperations(
      synchronization.receivedOperations,
      'provider'
    )
  }

  private async processRemoteOperations(
    operations: readonly unknown[],
    source: InboundYjsUpdateSource
  ): Promise<void> {
    for (const decoded of operations) {
      const validation = validateRemoteOperation({
        decoded,
        documentId: this.identity.documentId,
        registry: this.operationRegistry,
        outcomes: this.operationOutcomes
      })
      if (validation.status !== 'validated') {
        this.emitOutcome({ direction: 'remote', source, outcome: validation })
        continue
      }

      const decision = await this.conflictPolicy.decide(validation)
      if (decision.status === 'rejected') {
        this.operationOutcomes.record(validation.envelope, {
          status: 'rejected',
          operationId: validation.envelope.operationId,
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

      const outcome = runRemoteCanonicalApply({
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

    if (this.startPromise) {
      await this.startPromise.catch(() => undefined)
    }
    for (const disposer of [...this.disposers].reverse()) {
      await attempt(disposer)
    }
    this.disposers.length = 0
    await this.whenIdle()
    this.durability.dispose()
    this.outcomeSubscribers.clear()

    if (this.composition.resourceOwnership.provider === 'owned') {
      await attempt(() => callLifecycle(this.provider))
    }
    if (this.composition.resourceOwnership.persistence === 'owned') {
      await attempt(() => callLifecycle(this.persistence))
    }
    if (this.composition.resourceOwnership.awareness === 'owned') {
      await attempt(() => callLifecycle(this.awareness))
    }
    if (this.composition.resourceOwnership.yDoc === 'owned') {
      await attempt(() => this.yDoc.destroy())
    }

    if (failures.length > 0) {
      throw new CollaborationDisposalError(failures)
    }
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new Error('[collaboration] instance is disposed')
    }
  }
}

export const createCollaboration = (
  input: CollaborationInstanceCompositionInput,
  defineComposition: (
    input: CollaborationInstanceCompositionInput
  ) => InstanceComposition
): CollaborationInstance => new CollaborationInstance(defineComposition(input))
