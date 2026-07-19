import type {
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage
} from './provider'

export type AwarenessValue =
  | null
  | string
  | number
  | boolean
  | AwarenessValue[]
  | { [key: string]: AwarenessValue }

export interface AwarenessStateInput {
  identity?: AwarenessValue
  cursor?: AwarenessValue
  selection?: AwarenessValue
  viewport?: AwarenessValue
  tool?: AwarenessValue
  editing?: AwarenessValue
}

export interface AwarenessState extends AwarenessStateInput {
  heartbeatAt?: number
}

export interface RemoteAwarenessSnapshot {
  readonly actorId: string
  readonly clock: number
  readonly state: Readonly<AwarenessState>
  readonly lastSeenAt: number
}

export type AwarenessRemovalReason = 'disconnect' | 'leave' | 'timeout'

export type AwarenessObservation =
  | Readonly<{
      type: 'updated'
      snapshot: RemoteAwarenessSnapshot
    }>
  | Readonly<{
      type: 'removed'
      actorId: string
      reason: AwarenessRemovalReason
    }>

export type AwarenessValidationErrorCode =
  | 'invalid-actor'
  | 'invalid-clock'
  | 'unsupported-field'
  | 'invalid-state'
  | 'disposed'

export class AwarenessValidationError extends Error {
  readonly code: AwarenessValidationErrorCode

  constructor(code: AwarenessValidationErrorCode, message: string) {
    super(message)
    this.name = 'AwarenessValidationError'
    this.code = code
  }
}

export interface AwarenessRuntimeOptions {
  readonly actorId?: string
  readonly timeoutMs?: number
  readonly now?: () => number
}

const allowedInputFields = new Set([
  'identity',
  'cursor',
  'selection',
  'viewport',
  'tool',
  'editing'
])
const allowedRemoteFields = new Set([...allowedInputFields, 'heartbeatAt'])

const cloneAwarenessValue = (
  value: unknown,
  seen = new WeakSet<object>()
): AwarenessValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return value
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness numbers must be finite'
    )
  }
  if (typeof value !== 'object') {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness contains an unsupported value'
    )
  }
  if (seen.has(value)) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness cannot contain circular values'
    )
  }
  seen.add(value)

  if (Array.isArray(value)) {
    const result = value.map((item) => cloneAwarenessValue(item, seen))
    seen.delete(value)
    return result
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness objects must be plain records'
    )
  }
  const result: Record<string, AwarenessValue> = {}
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness cannot contain symbol keys'
      )
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable) continue
    result[key] = cloneAwarenessValue(Reflect.get(value, key), seen)
  }
  seen.delete(value)
  return result
}

const freezeDeep = <T>(value: T, seen = new WeakSet<object>()): T => {
  if (value === null || typeof value !== 'object') return value
  const object = value as object
  if (seen.has(object)) return value
  seen.add(object)
  Reflect.ownKeys(object).forEach((key) =>
    freezeDeep(Reflect.get(object, key), seen)
  )
  return Object.freeze(value)
}

const requireActor = (actorId: string): string => {
  if (!actorId.trim()) {
    throw new AwarenessValidationError(
      'invalid-actor',
      '[collaboration] awareness actorId is required'
    )
  }
  return actorId
}

const cloneState = (
  input: Record<string, unknown>,
  allowedFields: ReadonlySet<string>
): AwarenessState => {
  for (const key of Object.keys(input)) {
    if (!allowedFields.has(key)) {
      throw new AwarenessValidationError(
        'unsupported-field',
        `[collaboration] unsupported awareness field ${key}`
      )
    }
  }
  return freezeDeep(cloneAwarenessValue(input) as AwarenessState)
}

const cloneSnapshot = (
  snapshot: RemoteAwarenessSnapshot
): RemoteAwarenessSnapshot =>
  freezeDeep({
    actorId: snapshot.actorId,
    clock: snapshot.clock,
    state: cloneState(
      snapshot.state as Record<string, unknown>,
      allowedRemoteFields
    ),
    lastSeenAt: snapshot.lastSeenAt
  })

export class AwarenessRuntime {
  readonly actorId: string
  private readonly timeoutMs: number
  private readonly now: () => number
  private clock = 0
  private disposed = false
  private readonly remote = new Map<string, RemoteAwarenessSnapshot>()
  private readonly remoteClocks = new Map<string, number>()
  private readonly subscribers = new Set<
    (event: AwarenessObservation) => void
  >()

  constructor(options: AwarenessRuntimeOptions = {}) {
    this.actorId = options.actorId ?? ''
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.now = options.now ?? Date.now
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness timeoutMs must be positive'
      )
    }
  }

  localClock(): number {
    return this.clock
  }

  updateLocal(input: AwarenessStateInput): ProviderAwarenessMessage {
    this.requireUsable()
    requireActor(this.actorId)
    const state = cloneState(
      { ...input, heartbeatAt: this.now() },
      allowedRemoteFields
    )
    this.clock += 1
    return freezeDeep({ actorId: this.actorId, clock: this.clock, state })
  }

  leaveLocal(): ProviderAwarenessMessage {
    this.requireUsable()
    requireActor(this.actorId)
    this.clock += 1
    return Object.freeze({
      actorId: this.actorId,
      clock: this.clock,
      state: null
    })
  }

  applyRemote(message: ProviderAwarenessMessage): boolean {
    this.requireUsable()
    const actorId = requireActor(message.actorId)
    if (!Number.isSafeInteger(message.clock) || message.clock < 0) {
      throw new AwarenessValidationError(
        'invalid-clock',
        '[collaboration] awareness clock must be a non-negative safe integer'
      )
    }
    if (actorId === this.actorId) return false
    if (message.clock <= (this.remoteClocks.get(actorId) ?? -1)) return false

    if (message.state === null) {
      this.remoteClocks.set(actorId, message.clock)
      this.remove(actorId, 'leave')
      return true
    }
    if (
      !message.state ||
      typeof message.state !== 'object' ||
      Array.isArray(message.state)
    ) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness state must be a record or null'
      )
    }
    const snapshot = freezeDeep({
      actorId,
      clock: message.clock,
      state: cloneState(
        message.state as Record<string, unknown>,
        allowedRemoteFields
      ),
      lastSeenAt: this.now()
    })
    this.remoteClocks.set(actorId, message.clock)
    this.remote.set(actorId, snapshot)
    this.emit({ type: 'updated', snapshot })
    return true
  }

  handleDisconnect(event: ProviderAwarenessDisconnect): boolean {
    this.requireUsable()
    return this.remove(event.actorId, 'disconnect')
  }

  expire(): readonly string[] {
    this.requireUsable()
    const currentTime = this.now()
    const expired = [...this.remote.values()]
      .filter((snapshot) => currentTime - snapshot.lastSeenAt >= this.timeoutMs)
      .map((snapshot) => snapshot.actorId)
    expired.forEach((actorId) => this.remove(actorId, 'timeout'))
    return Object.freeze(expired)
  }

  observe(subscriber: (event: AwarenessObservation) => void): () => void {
    this.requireUsable()
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  getRemote(actorId: string): RemoteAwarenessSnapshot | undefined {
    const snapshot = this.remote.get(actorId)
    return snapshot ? cloneSnapshot(snapshot) : undefined
  }

  remoteActors(): readonly string[] {
    return Object.freeze([...this.remote.keys()])
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.remote.clear()
    this.remoteClocks.clear()
    this.subscribers.clear()
  }

  isDisposed(): boolean {
    return this.disposed
  }

  private remove(actorId: string, reason: AwarenessRemovalReason): boolean {
    if (!this.remote.delete(actorId)) return false
    this.emit({ type: 'removed', actorId, reason })
    return true
  }

  private emit(event: AwarenessObservation): void {
    ;[...this.subscribers].forEach((subscriber) => {
      try {
        subscriber(
          event.type === 'updated'
            ? freezeDeep({
                type: 'updated' as const,
                snapshot: cloneSnapshot(event.snapshot)
              })
            : Object.freeze({ ...event })
        )
      } catch {
        // Awareness observers cannot alter ephemeral ownership.
      }
    })
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new AwarenessValidationError(
        'disposed',
        '[collaboration] awareness runtime is disposed'
      )
    }
  }
}
