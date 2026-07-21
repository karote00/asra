import type {
  ProviderAwarenessDisconnect,
  ProviderAwarenessMessage
} from './provider'

export interface AwarenessRecord {
  [key: string]: AwarenessValue
}

export type AwarenessValue =
  | null
  | string
  | number
  | boolean
  | AwarenessValue[]
  | AwarenessRecord

export type AwarenessStateInput = Readonly<
  Record<string, AwarenessValue | undefined>
> & {
  readonly heartbeatAt?: never
}

export type AwarenessState = Readonly<
  Record<string, AwarenessValue | undefined>
> & {
  readonly heartbeatAt?: number
}

export interface RemoteAwarenessSnapshot {
  readonly actorId: string
  readonly clock: number
  readonly state: Readonly<AwarenessState>
  readonly lastSeenAt: number
}

export type AwarenessRemovalReason = 'disconnect' | 'leave' | 'timeout'

export interface AwarenessUpdatedObservation {
  readonly type: 'updated'
  readonly snapshot: RemoteAwarenessSnapshot
}

export interface AwarenessRemovedObservation {
  readonly type: 'removed'
  readonly actorId: string
  readonly reason: AwarenessRemovalReason
}

export type AwarenessObservation =
  | AwarenessUpdatedObservation
  | AwarenessRemovedObservation

export type AwarenessValidationErrorCode =
  | 'invalid-actor'
  | 'invalid-clock'
  | 'reserved-field'
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

export interface AwarenessOptions {
  readonly actorId?: string
  readonly timeoutMs?: number
  readonly now?: () => number
}

const inboundMessageFields = new Set(['actorId', 'clock', 'state'])
const inboundDisconnectFields = new Set(['actorId', 'reason'])

interface InertAwarenessMessage {
  readonly actorId: unknown
  readonly clock: unknown
  readonly state: unknown
}

interface InertAwarenessDisconnect {
  readonly actorId: unknown
  readonly reason: unknown
}

const readInboundDisconnect = (event: unknown): InertAwarenessDisconnect => {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness disconnect must be a record'
    )
  }
  const prototype = Object.getPrototypeOf(event)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness disconnect must be a plain record'
    )
  }
  const candidate = event as Record<string, unknown>
  const descriptors = new Map<string, PropertyDescriptor>()
  for (const key of Reflect.ownKeys(candidate)) {
    if (typeof key !== 'string' || !inboundDisconnectFields.has(key)) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness disconnect contains an unsupported field'
      )
    }
    const descriptor = Object.getOwnPropertyDescriptor(candidate, key)
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness disconnect accessors are not supported'
      )
    }
    descriptors.set(key, descriptor)
  }
  if ([...inboundDisconnectFields].some((field) => !descriptors.has(field))) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness disconnect is missing a required field'
    )
  }
  return Object.freeze({
    actorId: descriptors.get('actorId')?.value,
    reason: descriptors.get('reason')?.value
  })
}

const readInboundMessage = (message: unknown): InertAwarenessMessage => {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness message must be a record'
    )
  }
  const prototype = Object.getPrototypeOf(message)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness message must be a plain record'
    )
  }
  const candidate = message as Record<string, unknown>
  const descriptors = new Map<string, PropertyDescriptor>()
  for (const key of Reflect.ownKeys(candidate)) {
    if (typeof key !== 'string' || !inboundMessageFields.has(key)) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness message contains an unsupported field'
      )
    }
    const descriptor = Object.getOwnPropertyDescriptor(candidate, key)
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness message accessors are not supported'
      )
    }
    descriptors.set(key, descriptor)
  }
  if ([...inboundMessageFields].some((field) => !descriptors.has(field))) {
    throw new AwarenessValidationError(
      'invalid-state',
      '[collaboration] awareness message is missing a required field'
    )
  }
  return Object.freeze({
    actorId: descriptors.get('actorId')?.value,
    clock: descriptors.get('clock')?.value,
    state: descriptors.get('state')?.value
  })
}

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
    const result: AwarenessValue[] = []
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, index)
      if (!descriptor || !('value' in descriptor)) {
        throw new AwarenessValidationError(
          'invalid-state',
          '[collaboration] awareness arrays must contain data values'
        )
      }
      result.push(cloneAwarenessValue(descriptor.value, seen))
    }
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
    if (!('value' in descriptor)) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness accessors are not supported'
      )
    }
    Object.defineProperty(result, key, {
      value: cloneAwarenessValue(descriptor.value, seen),
      enumerable: true,
      configurable: true,
      writable: true
    })
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

const requireActor = (actorId: unknown): string => {
  if (typeof actorId !== 'string' || !actorId.trim()) {
    throw new AwarenessValidationError(
      'invalid-actor',
      '[collaboration] awareness actorId is required'
    )
  }
  return actorId
}

const cloneState = (
  input: Record<string, unknown>,
  allowHeartbeatAt: boolean
): AwarenessState => {
  if (
    !allowHeartbeatAt &&
    Object.prototype.hasOwnProperty.call(input, 'heartbeatAt')
  ) {
    throw new AwarenessValidationError(
      'reserved-field',
      '[collaboration] awareness heartbeatAt is runtime-owned'
    )
  }
  return freezeDeep(cloneAwarenessValue(input) as AwarenessState)
}

const cloneSnapshot = (
  snapshot: RemoteAwarenessSnapshot
): RemoteAwarenessSnapshot =>
  freezeDeep({
    actorId: snapshot.actorId,
    clock: snapshot.clock,
    state: cloneState(snapshot.state as Record<string, unknown>, true),
    lastSeenAt: snapshot.lastSeenAt
  })

export class Awareness {
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

  constructor(options: AwarenessOptions = {}) {
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
    const selectedState = cloneState(input as Record<string, unknown>, false)
    const state = cloneState(
      { ...selectedState, heartbeatAt: this.now() },
      true
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
    const candidate = readInboundMessage(message)
    const actorId = requireActor(candidate.actorId)
    if (
      typeof candidate.clock !== 'number' ||
      !Number.isSafeInteger(candidate.clock) ||
      candidate.clock < 0
    ) {
      throw new AwarenessValidationError(
        'invalid-clock',
        '[collaboration] awareness clock must be a non-negative safe integer'
      )
    }
    const clock = candidate.clock
    if (actorId === this.actorId) return false
    if (clock <= (this.remoteClocks.get(actorId) ?? -1)) return false

    if (candidate.state === null) {
      this.remoteClocks.set(actorId, clock)
      this.remove(actorId, 'leave')
      return true
    }
    if (
      !candidate.state ||
      typeof candidate.state !== 'object' ||
      Array.isArray(candidate.state)
    ) {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness state must be a record or null'
      )
    }
    const snapshot = freezeDeep({
      actorId,
      clock,
      state: cloneState(candidate.state as Record<string, unknown>, true),
      lastSeenAt: this.now()
    })
    this.remoteClocks.set(actorId, clock)
    this.remote.set(actorId, snapshot)
    this.emit({ type: 'updated', snapshot })
    return true
  }

  handleDisconnect(event: ProviderAwarenessDisconnect): boolean {
    this.requireUsable()
    const candidate = readInboundDisconnect(event)
    const actorId = requireActor(candidate.actorId)
    if (candidate.reason !== 'disconnect') {
      throw new AwarenessValidationError(
        'invalid-state',
        '[collaboration] awareness disconnect reason is invalid'
      )
    }
    this.remoteClocks.delete(actorId)
    return this.remove(actorId, 'disconnect')
  }

  clearRemote(reason: 'disconnect'): readonly string[] {
    this.requireUsable()
    const actorIds = [...this.remote.keys()]
    this.remoteClocks.clear()
    actorIds.forEach((actorId) => this.remove(actorId, reason))
    return Object.freeze(actorIds)
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
        '[collaboration] awareness is disposed'
      )
    }
  }
}
