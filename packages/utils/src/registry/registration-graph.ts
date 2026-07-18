export const REGISTRATION_CONTRACT_ERROR_CODES = [
  'COMPOSITION_CLOSED',
  'REGISTRATION_NOT_FOUND',
  'RELATION_NOT_FOUND',
  'DUPLICATE_RELATION',
  'RELATION_TARGET_NOT_FOUND',
  'REGISTRATION_IN_USE',
  'RELATION_REMOVE_FAILED',
  'UNREGISTER_FAILED',
  'DANGLING_RELATION'
] as const

export type RegistrationContractErrorCode =
  (typeof REGISTRATION_CONTRACT_ERROR_CODES)[number]

export interface RegistrationRef {
  kind: string
  key: string
}

export interface RegistrationOwnerMetadata {
  packageName: string
  name: string
}

export type RegistrationRelationUnregisterPolicy =
  | 'detach'
  | 'unregister-source'

export interface RegistrationRelationDeclaration {
  name: string
  target: RegistrationRef
  onTargetUnregister: RegistrationRelationUnregisterPolicy
}

/**
 * Optional package-owned graph metadata carried by a normal registration
 * definition. App registrations may omit this and receive the stable app owner.
 */
export interface RegistrationDefinitionMetadata {
  owner?: RegistrationOwnerMetadata
  relations?: readonly RegistrationRelationDeclaration[]
}

export interface RegistrationRelationMetadata
  extends RegistrationRelationDeclaration {
  source: RegistrationRef
}

export interface RegistrationNodeMetadata {
  ref: RegistrationRef
  owner: RegistrationOwnerMetadata
}

export interface RegistrationOwnedResource {
  key: string
  dispose: () => void
}

export interface RegistrationNodeHandlers {
  isPresent?: () => boolean
  preflightUnregister?: (ref: RegistrationRef) => void
  preflightDetachRelation?: (relation: RegistrationRelationMetadata) => void
  detachRelation?: (relation: RegistrationRelationMetadata) => void
}

export interface RegistrationNodeDefinition {
  ref: RegistrationRef
  owner?: RegistrationOwnerMetadata
  handlers?: RegistrationNodeHandlers
  resources?: readonly RegistrationOwnedResource[]
}

export type RegistrationGraphOperation =
  | 'register-node'
  | 'transfer-owner'
  | 'define-relation'
  | 'remove-relation'
  | 'unregister-registration'
  | 'validate-relations'

export interface RelationOperationSuccess {
  ok: true
  operation: 'register-node' | 'define-relation' | 'remove-relation'
  source: RegistrationRef
  registration?: RegistrationNodeMetadata
  relation?: RegistrationRelationMetadata
}

export interface RegistrationCleanupFailure {
  key: string
  cause: unknown
}

export interface UnregisterRegistrationSuccess {
  ok: true
  operation: 'unregister-registration'
  root: RegistrationRef
  removedRelations: readonly RegistrationRelationMetadata[]
  detachedSources: readonly RegistrationRef[]
  recursivelyUnregisteredSources: readonly RegistrationRef[]
  removedOwnedRegistrations: readonly string[]
  cleanupFailures: readonly RegistrationCleanupFailure[]
  pendingCleanup: readonly string[]
}

export interface RegistrationRelationFailure {
  ok: false
  operation: RegistrationGraphOperation
  code: RegistrationContractErrorCode
  message: string
  registration?: RegistrationRef
  source?: RegistrationRef
  relationName?: string
  target?: RegistrationRef
  cause?: unknown
  cleanupFailures?: readonly RegistrationCleanupFailure[]
  pendingCleanup?: readonly string[]
}

export class RegistrationRelationError extends Error {
  readonly result: RegistrationRelationFailure
  readonly code: RegistrationContractErrorCode

  constructor(result: RegistrationRelationFailure) {
    super(result.message)
    this.name = 'RegistrationRelationError'
    this.result = result
    this.code = result.code
  }
}

export interface RegistrationGraphOptions {
  isCompositionOpen?: () => boolean
}

interface ResourceRecord extends RegistrationOwnedResource {
  disposed: boolean
}

interface NodeRecord extends RegistrationNodeMetadata {
  handlers: RegistrationNodeHandlers
  resources: ResourceRecord[]
}

interface PendingUnregister {
  root: RegistrationRef
  queue: RegistrationRef[]
  relations: RegistrationRelationMetadata[]
  detachedSources: RegistrationRef[]
  processedDetachRelationKeys: Set<string>
  relationsProcessed: boolean
  removedOwnedRegistrations: string[]
}

const refKey = (ref: RegistrationRef): string => `${ref.kind}\u0000${ref.key}`

const compareRefs = (left: RegistrationRef, right: RegistrationRef): number =>
  refKey(left).localeCompare(refKey(right))

const relationKey = (relation: RegistrationRelationMetadata): string =>
  `${refKey(relation.source)}\u0000${relation.name}`

const compareRelations = (
  left: RegistrationRelationMetadata,
  right: RegistrationRelationMetadata
): number => relationKey(left).localeCompare(relationKey(right))

const cloneRef = (ref: RegistrationRef): RegistrationRef => ({ ...ref })

const cloneOwner = (
  owner: RegistrationOwnerMetadata
): RegistrationOwnerMetadata => ({ ...owner })

const cloneNode = (
  node: RegistrationNodeMetadata
): RegistrationNodeMetadata => ({
  ref: cloneRef(node.ref),
  owner: cloneOwner(node.owner)
})

const cloneRelation = (
  relation: RegistrationRelationMetadata
): RegistrationRelationMetadata => ({
  name: relation.name,
  source: cloneRef(relation.source),
  target: cloneRef(relation.target),
  onTargetUnregister: relation.onTargetUnregister
})

const relationFailure = (
  code: RegistrationContractErrorCode,
  operation: RegistrationGraphOperation,
  message: string,
  details: Omit<
    RegistrationRelationFailure,
    'ok' | 'code' | 'operation' | 'message'
  > = {}
): never => {
  throw new RegistrationRelationError({
    ok: false,
    code,
    operation,
    message,
    ...details
  })
}

export class RegistrationGraph {
  private readonly nodesByRef = new Map<string, NodeRecord>()
  private readonly outgoingRelationsBySource = new Map<
    string,
    Map<string, RegistrationRelationMetadata>
  >()
  private readonly incomingRelationsByTarget = new Map<
    string,
    Map<string, RegistrationRelationMetadata>
  >()
  private readonly pendingUnregisterByRoot = new Map<
    string,
    PendingUnregister
  >()
  private readonly pendingRootByNode = new Map<string, string>()
  private readonly isCompositionOpen: () => boolean

  constructor(options: RegistrationGraphOptions = {}) {
    this.isCompositionOpen = options.isCompositionOpen ?? (() => true)
  }

  registerNode(
    definition: RegistrationNodeDefinition
  ): RelationOperationSuccess {
    this.assertCompositionOpen('register-node')
    const key = refKey(definition.ref)
    const existing = this.nodesByRef.get(key)
    if (existing) {
      const pendingRoot = this.pendingRootByNode.get(key)
      return relationFailure(
        'UNREGISTER_FAILED',
        'register-node',
        pendingRoot
          ? `Registration "${definition.ref.kind}:${definition.ref.key}" still has pending cleanup`
          : `Registration "${definition.ref.kind}:${definition.ref.key}" is already registered`,
        {
          registration: cloneRef(definition.ref),
          pendingCleanup: pendingRoot
            ? this.getPendingCleanup(
                this.pendingUnregisterByRoot.get(pendingRoot)
              )
            : undefined
        }
      )
    }

    const record: NodeRecord = {
      ref: cloneRef(definition.ref),
      owner: definition.owner
        ? cloneOwner(definition.owner)
        : { packageName: 'app', name: definition.ref.key },
      handlers: { ...definition.handlers },
      resources: (definition.resources ?? []).map((resource) => ({
        key: resource.key,
        dispose: resource.dispose,
        disposed: false
      }))
    }
    this.nodesByRef.set(key, record)

    return {
      ok: true,
      operation: 'register-node',
      source: cloneRef(record.ref),
      registration: cloneNode(record)
    }
  }

  getRegistration(ref: RegistrationRef): RegistrationNodeMetadata | undefined {
    const node = this.nodesByRef.get(refKey(ref))
    return node ? cloneNode(node) : undefined
  }

  hasPendingCleanup(ref: RegistrationRef): boolean {
    return this.pendingRootByNode.has(refKey(ref))
  }

  getRegistrations(): RegistrationNodeMetadata[] {
    return [...this.nodesByRef.values()]
      .sort((left, right) => compareRefs(left.ref, right.ref))
      .map(cloneNode)
  }

  getRelations(): RegistrationRelationMetadata[] {
    return [...this.outgoingRelationsBySource.values()]
      .flatMap((relations) => [...relations.values()])
      .sort(compareRelations)
      .map(cloneRelation)
  }

  getOutgoingRelations(
    source: RegistrationRef
  ): RegistrationRelationMetadata[] {
    return [
      ...(this.outgoingRelationsBySource.get(refKey(source))?.values() ?? [])
    ]
      .sort(compareRelations)
      .map(cloneRelation)
  }

  getIncomingRelations(
    target: RegistrationRef
  ): RegistrationRelationMetadata[] {
    return [
      ...(this.incomingRelationsByTarget.get(refKey(target))?.values() ?? [])
    ]
      .sort(compareRelations)
      .map(cloneRelation)
  }

  transferRegistrationOwner(
    ref: RegistrationRef,
    owner: RegistrationOwnerMetadata
  ): RegistrationNodeMetadata {
    this.assertCompositionOpen('transfer-owner')
    const node = this.nodesByRef.get(refKey(ref))
    if (!node) {
      return relationFailure(
        'REGISTRATION_NOT_FOUND',
        'transfer-owner',
        `Registration "${ref.kind}:${ref.key}" was not found`,
        { registration: cloneRef(ref) }
      )
    }
    this.assertNodeNotPending(ref, 'transfer-owner')

    node.owner = cloneOwner(owner)
    return cloneNode(node)
  }

  defineRelation(
    source: RegistrationRef,
    declaration: RegistrationRelationDeclaration
  ): RelationOperationSuccess {
    this.assertCompositionOpen('define-relation')
    const sourceRecord = this.nodesByRef.get(refKey(source))
    if (!sourceRecord) {
      return relationFailure(
        'REGISTRATION_NOT_FOUND',
        'define-relation',
        `Registration "${source.kind}:${source.key}" was not found`,
        { source: cloneRef(source), relationName: declaration.name }
      )
    }
    this.assertNodeNotPending(source, 'define-relation')

    const targetRecord = this.nodesByRef.get(refKey(declaration.target))
    if (!targetRecord) {
      return relationFailure(
        'RELATION_TARGET_NOT_FOUND',
        'define-relation',
        `Relation target "${declaration.target.kind}:${declaration.target.key}" was not found`,
        {
          source: cloneRef(source),
          relationName: declaration.name,
          target: cloneRef(declaration.target)
        }
      )
    }
    this.assertNodeNotPending(declaration.target, 'define-relation')

    const outgoing = this.getOrCreateRelationIndex(
      this.outgoingRelationsBySource,
      refKey(source)
    )
    if (outgoing.has(declaration.name)) {
      return relationFailure(
        'DUPLICATE_RELATION',
        'define-relation',
        `Relation "${source.kind}:${source.key}/${declaration.name}" is already defined`,
        { source: cloneRef(source), relationName: declaration.name }
      )
    }

    const relation: RegistrationRelationMetadata = {
      source: cloneRef(sourceRecord.ref),
      name: declaration.name,
      target: cloneRef(targetRecord.ref),
      onTargetUnregister: declaration.onTargetUnregister
    }
    outgoing.set(relation.name, relation)
    this.getOrCreateRelationIndex(
      this.incomingRelationsByTarget,
      refKey(relation.target)
    ).set(relationKey(relation), relation)

    return {
      ok: true,
      operation: 'define-relation',
      source: cloneRef(source),
      relation: cloneRelation(relation)
    }
  }

  removeRelation(
    source: RegistrationRef,
    name: string
  ): RelationOperationSuccess {
    this.assertCompositionOpen('remove-relation')
    if (!this.nodesByRef.has(refKey(source))) {
      return relationFailure(
        'REGISTRATION_NOT_FOUND',
        'remove-relation',
        `Registration "${source.kind}:${source.key}" was not found`,
        { source: cloneRef(source), relationName: name }
      )
    }
    this.assertNodeNotPending(source, 'remove-relation')

    const relation = this.outgoingRelationsBySource
      .get(refKey(source))
      ?.get(name)
    if (!relation) {
      return relationFailure(
        'RELATION_NOT_FOUND',
        'remove-relation',
        `Relation "${source.kind}:${source.key}/${name}" was not found`,
        { source: cloneRef(source), relationName: name }
      )
    }
    this.removeRelationRecord(relation)

    return {
      ok: true,
      operation: 'remove-relation',
      source: cloneRef(source),
      relation: cloneRelation(relation)
    }
  }

  validateRelations(): void {
    for (const relation of this.getRelations()) {
      const source = this.nodesByRef.get(refKey(relation.source))
      const target = this.nodesByRef.get(refKey(relation.target))
      let sourcePresent = Boolean(source)
      let targetPresent = Boolean(target)
      try {
        sourcePresent =
          sourcePresent && (source?.handlers.isPresent?.() ?? true)
        targetPresent =
          targetPresent && (target?.handlers.isPresent?.() ?? true)
      } catch (cause) {
        return relationFailure(
          'DANGLING_RELATION',
          'validate-relations',
          `Relation "${relation.source.kind}:${relation.source.key}/${relation.name}" could not validate its owner registration`,
          { ...this.relationDetails(relation), cause }
        )
      }
      if (!sourcePresent || !targetPresent) {
        return relationFailure(
          'DANGLING_RELATION',
          'validate-relations',
          `Relation "${relation.source.kind}:${relation.source.key}/${relation.name}" references an unavailable registration`,
          this.relationDetails(relation)
        )
      }
    }
  }

  unregister(root: RegistrationRef): UnregisterRegistrationSuccess {
    this.assertCompositionOpen('unregister-registration')
    const rootKey = refKey(root)
    if (!this.nodesByRef.has(rootKey)) {
      return relationFailure(
        'REGISTRATION_NOT_FOUND',
        'unregister-registration',
        `Registration "${root.kind}:${root.key}" was not found`,
        { registration: cloneRef(root) }
      )
    }

    const pendingRoot = this.pendingRootByNode.get(rootKey)
    if (pendingRoot && pendingRoot !== rootKey) {
      return relationFailure(
        'UNREGISTER_FAILED',
        'unregister-registration',
        `Registration "${root.kind}:${root.key}" belongs to another pending unregister operation`,
        {
          registration: cloneRef(root),
          pendingCleanup: this.getPendingCleanup(
            this.pendingUnregisterByRoot.get(pendingRoot)
          )
        }
      )
    }

    let pending = this.pendingUnregisterByRoot.get(rootKey)
    if (!pending) {
      pending = this.prepareUnregister(root)
      this.pendingUnregisterByRoot.set(rootKey, pending)
      pending.queue.forEach((item) =>
        this.pendingRootByNode.set(refKey(item), rootKey)
      )
    }

    if (!pending.relationsProcessed) {
      this.processUnregisterRelations(pending)
    }

    const cleanupFailures = this.disposePendingResources(pending)
    const pendingCleanup = this.getPendingCleanup(pending)
    if (cleanupFailures.length > 0) {
      return relationFailure(
        'UNREGISTER_FAILED',
        'unregister-registration',
        `Registration "${root.kind}:${root.key}" cleanup failed`,
        {
          registration: cloneRef(root),
          cleanupFailures,
          pendingCleanup
        }
      )
    }

    for (const item of [...pending.queue].reverse()) {
      const key = refKey(item)
      this.nodesByRef.delete(key)
      this.outgoingRelationsBySource.delete(key)
      this.incomingRelationsByTarget.delete(key)
      this.pendingRootByNode.delete(key)
    }
    this.pendingUnregisterByRoot.delete(rootKey)

    return {
      ok: true,
      operation: 'unregister-registration',
      root: cloneRef(pending.root),
      removedRelations: pending.relations.map(cloneRelation),
      detachedSources: pending.detachedSources.map(cloneRef),
      recursivelyUnregisteredSources: pending.queue.slice(1).map(cloneRef),
      removedOwnedRegistrations: [...pending.removedOwnedRegistrations],
      cleanupFailures: [],
      pendingCleanup: []
    }
  }

  private assertCompositionOpen(operation: RegistrationGraphOperation): void {
    if (!this.isCompositionOpen()) {
      return relationFailure(
        'COMPOSITION_CLOSED',
        operation,
        'Registration composition is permanently closed'
      )
    }
  }

  private assertNodeNotPending(
    ref: RegistrationRef,
    operation: RegistrationGraphOperation
  ): void {
    const pendingRoot = this.pendingRootByNode.get(refKey(ref))
    if (!pendingRoot) return
    return relationFailure(
      'UNREGISTER_FAILED',
      operation,
      `Registration "${ref.kind}:${ref.key}" still has pending cleanup`,
      {
        registration: cloneRef(ref),
        pendingCleanup: this.getPendingCleanup(
          this.pendingUnregisterByRoot.get(pendingRoot)
        )
      }
    )
  }

  private getOrCreateRelationIndex(
    index: Map<string, Map<string, RegistrationRelationMetadata>>,
    key: string
  ): Map<string, RegistrationRelationMetadata> {
    const existing = index.get(key)
    if (existing) return existing
    const created = new Map<string, RegistrationRelationMetadata>()
    index.set(key, created)
    return created
  }

  private removeRelationRecord(relation: RegistrationRelationMetadata): void {
    const sourceKey = refKey(relation.source)
    const targetKey = refKey(relation.target)
    const outgoing = this.outgoingRelationsBySource.get(sourceKey)
    outgoing?.delete(relation.name)
    if (outgoing?.size === 0) this.outgoingRelationsBySource.delete(sourceKey)

    const incoming = this.incomingRelationsByTarget.get(targetKey)
    incoming?.delete(relationKey(relation))
    if (incoming?.size === 0) this.incomingRelationsByTarget.delete(targetKey)
  }

  private getCurrentRelation(
    relation: RegistrationRelationMetadata
  ): RegistrationRelationMetadata | undefined {
    return this.outgoingRelationsBySource
      .get(refKey(relation.source))
      ?.get(relation.name)
  }

  private isSameRelation(
    current: RegistrationRelationMetadata,
    expected: RegistrationRelationMetadata
  ): boolean {
    return (
      refKey(current.source) === refKey(expected.source) &&
      current.name === expected.name &&
      refKey(current.target) === refKey(expected.target) &&
      current.onTargetUnregister === expected.onTargetUnregister
    )
  }

  private prepareUnregister(root: RegistrationRef): PendingUnregister {
    const queue: RegistrationRef[] = [cloneRef(root)]
    const visited = new Set<string>()

    let index = 0
    while (index < queue.length) {
      const current = queue[index]
      index += 1
      const currentKey = refKey(current)
      if (visited.has(currentKey)) continue
      visited.add(currentKey)

      for (const relation of this.getIncomingRelations(current)) {
        if (relation.onTargetUnregister !== 'unregister-source') continue
        const sourceKey = refKey(relation.source)
        if (!visited.has(sourceKey)) queue.push(cloneRef(relation.source))
      }
    }

    const uniqueQueue = queue.filter(
      (item, index, items) =>
        items.findIndex((candidate) => refKey(candidate) === refKey(item)) ===
        index
    )
    const removalKeys = new Set(uniqueQueue.map(refKey))
    const relations = this.getRelations().filter(
      (relation) =>
        removalKeys.has(refKey(relation.source)) ||
        removalKeys.has(refKey(relation.target))
    )
    const detachedRelations = relations.filter(
      (relation) =>
        removalKeys.has(refKey(relation.target)) &&
        !removalKeys.has(refKey(relation.source)) &&
        relation.onTargetUnregister === 'detach'
    )

    for (const item of uniqueQueue) {
      const record = this.nodesByRef.get(refKey(item))
      try {
        record?.handlers.preflightUnregister?.(cloneRef(item))
      } catch (cause) {
        if (cause instanceof RegistrationRelationError) throw cause
        return relationFailure(
          'REGISTRATION_IN_USE',
          'unregister-registration',
          `Registration "${item.kind}:${item.key}" cannot be unregistered while in use`,
          { registration: cloneRef(item), cause }
        )
      }
    }
    for (const relation of detachedRelations) {
      const source = this.nodesByRef.get(refKey(relation.source))
      try {
        source?.handlers.preflightDetachRelation?.(cloneRelation(relation))
      } catch (cause) {
        if (cause instanceof RegistrationRelationError) throw cause
        return relationFailure(
          'REGISTRATION_IN_USE',
          'unregister-registration',
          `Relation "${relation.source.kind}:${relation.source.key}/${relation.name}" cannot be detached while in use`,
          { ...this.relationDetails(relation), cause }
        )
      }
    }

    return {
      root: cloneRef(root),
      queue: uniqueQueue,
      relations,
      detachedSources: detachedRelations
        .map((relation) => relation.source)
        .filter(
          (item, index, items) =>
            items.findIndex(
              (candidate) => refKey(candidate) === refKey(item)
            ) === index
        )
        .sort(compareRefs)
        .map(cloneRef),
      processedDetachRelationKeys: new Set<string>(),
      relationsProcessed: false,
      removedOwnedRegistrations: []
    }
  }

  private processUnregisterRelations(pending: PendingUnregister): void {
    const removalKeys = new Set(pending.queue.map(refKey))
    for (const relation of pending.relations) {
      if (
        removalKeys.has(refKey(relation.target)) &&
        !removalKeys.has(refKey(relation.source)) &&
        relation.onTargetUnregister === 'detach'
      ) {
        const key = relationKey(relation)
        if (pending.processedDetachRelationKeys.has(key)) continue
        const currentRelation = this.getCurrentRelation(relation)
        if (
          !currentRelation ||
          !this.isSameRelation(currentRelation, relation)
        ) {
          pending.processedDetachRelationKeys.add(key)
          continue
        }
        const source = this.nodesByRef.get(refKey(relation.source))
        try {
          source?.handlers.detachRelation?.(cloneRelation(relation))
        } catch (cause) {
          return relationFailure(
            'RELATION_REMOVE_FAILED',
            'unregister-registration',
            `Relation "${relation.source.kind}:${relation.source.key}/${relation.name}" detach failed`,
            { ...this.relationDetails(relation), cause }
          )
        }
        this.removeRelationRecord(currentRelation)
        pending.processedDetachRelationKeys.add(key)
      }
    }
    pending.relations.forEach((relation) => {
      if (!pending.processedDetachRelationKeys.has(relationKey(relation))) {
        const currentRelation = this.getCurrentRelation(relation)
        if (currentRelation && this.isSameRelation(currentRelation, relation)) {
          this.removeRelationRecord(currentRelation)
        }
      }
    })
    pending.relationsProcessed = true
  }

  private disposePendingResources(
    pending: PendingUnregister
  ): RegistrationCleanupFailure[] {
    const failures: RegistrationCleanupFailure[] = []
    for (const item of [...pending.queue].reverse()) {
      const node = this.nodesByRef.get(refKey(item))
      if (!node) continue
      for (let index = node.resources.length - 1; index >= 0; index -= 1) {
        const resource = node.resources[index]
        if (resource.disposed) continue
        try {
          resource.dispose()
          resource.disposed = true
          pending.removedOwnedRegistrations.push(resource.key)
        } catch (cause) {
          failures.push({ key: resource.key, cause })
        }
      }
    }
    return failures
  }

  private getPendingCleanup(
    pending: PendingUnregister | undefined
  ): string[] | undefined {
    if (!pending) return undefined
    const keys: string[] = []
    for (const item of [...pending.queue].reverse()) {
      const node = this.nodesByRef.get(refKey(item))
      if (!node) continue
      for (let index = node.resources.length - 1; index >= 0; index -= 1) {
        if (!node.resources[index].disposed)
          keys.push(node.resources[index].key)
      }
    }
    return keys
  }

  private relationDetails(
    relation: RegistrationRelationMetadata
  ): Pick<RegistrationRelationFailure, 'source' | 'relationName' | 'target'> {
    return {
      source: cloneRef(relation.source),
      relationName: relation.name,
      target: cloneRef(relation.target)
    }
  }
}
