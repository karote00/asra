import type { SharedOperationEnvelope } from './envelope'

const CANONICAL_OPERATION_APPLY = Symbol('canonical-operation-apply')

export type CanonicalOperationApply<TPayload = unknown> = {
  bivarianceHack(envelope: SharedOperationEnvelope<TPayload>): unknown
}['bivarianceHack'] & {
  readonly [CANONICAL_OPERATION_APPLY]: true
}

export const defineCanonicalOperationApply = <
  TPayload = unknown,
  TResult = void
>(
  apply: (
    envelope: SharedOperationEnvelope<TPayload>
  ) => TResult & (TResult extends PromiseLike<unknown> ? never : unknown)
): CanonicalOperationApply<TPayload> => {
  if (Object.prototype.toString.call(apply) === '[object AsyncFunction]') {
    throw new Error(
      '[collaboration] canonical apply handler must be synchronous'
    )
  }
  const canonicalApply = (
    envelope: SharedOperationEnvelope<TPayload>
  ): TResult => apply(envelope)
  Object.defineProperty(canonicalApply, CANONICAL_OPERATION_APPLY, {
    value: true
  })
  return canonicalApply as CanonicalOperationApply<TPayload>
}

export const isCanonicalOperationApply = (
  value: unknown
): value is CanonicalOperationApply =>
  typeof value === 'function' &&
  Reflect.get(value, CANONICAL_OPERATION_APPLY) === true

export interface OperationDefinition<TPayload = unknown> {
  channel: string
  eventName: string
  schemaVersion: number
  validate: (payload: unknown) => payload is TPayload
  apply?: CanonicalOperationApply<TPayload>
}

const requireRoutePart = (name: string, value: string): string => {
  if (!value.trim()) {
    throw new Error(`[collaboration] operation ${name} is required`)
  }
  return value
}

const routeKey = (channel: string, eventName: string): string =>
  JSON.stringify([channel, eventName])

export class OperationRegistry {
  private readonly definitions = new Map<string, OperationDefinition>()

  constructor(definitions: readonly OperationDefinition[] = []) {
    definitions.forEach((definition) => this.register(definition))
  }

  register<TPayload>(
    definition: OperationDefinition<TPayload>
  ): OperationDefinition<TPayload> {
    const channel = requireRoutePart('channel', definition.channel)
    const eventName = requireRoutePart('eventName', definition.eventName)
    if (
      !Number.isInteger(definition.schemaVersion) ||
      definition.schemaVersion <= 0
    ) {
      throw new Error(
        '[collaboration] schemaVersion must be a positive integer'
      )
    }
    if (typeof definition.validate !== 'function') {
      throw new Error('[collaboration] operation validator is required')
    }
    if (
      definition.apply !== undefined &&
      !isCanonicalOperationApply(definition.apply)
    ) {
      throw new Error(
        '[collaboration] canonical apply handler must use defineCanonicalOperationApply'
      )
    }

    const key = routeKey(channel, eventName)
    if (this.definitions.has(key)) {
      throw new Error(
        `[collaboration] duplicate operation ${channel}/${eventName}`
      )
    }

    const registered = Object.freeze({
      channel,
      eventName,
      schemaVersion: definition.schemaVersion,
      validate: definition.validate,
      ...(definition.apply ? { apply: definition.apply } : {})
    }) as OperationDefinition<TPayload>
    this.definitions.set(key, registered)
    return registered
  }

  resolve<TPayload = unknown>(
    channel: string,
    eventName: string
  ): OperationDefinition<TPayload> | undefined {
    return this.definitions.get(routeKey(channel, eventName)) as
      | OperationDefinition<TPayload>
      | undefined
  }
}
