export interface OperationDefinition<TPayload = unknown> {
  channel: string
  eventName: string
  schemaVersion: number
  validate: (payload: unknown) => payload is TPayload
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
      validate: definition.validate
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
