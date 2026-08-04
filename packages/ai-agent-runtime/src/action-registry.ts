import type {
  AiActionDefinition,
  AiActionDescription,
  AiActionRegistry,
  AiActionRegistryErrorCode,
  AiActionResult,
  AiJsonValue
} from './types.js'

export class AiActionRegistryError extends Error {
  readonly code: AiActionRegistryErrorCode

  constructor(code: AiActionRegistryErrorCode, message: string) {
    super(message)
    this.name = 'AiActionRegistryError'
    this.code = code
  }
}

const registryError = (
  code: AiActionRegistryErrorCode,
  message: string
): never => {
  throw new AiActionRegistryError(code, message)
}

const detachJsonValue = (
  value: unknown,
  ancestors = new WeakSet<object>()
): AiJsonValue => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return registryError(
        'AI_ACTION_INVALID_INPUT_SCHEMA',
        'Action input schema must contain only finite JSON numbers.'
      )
    }

    return value
  }

  if (typeof value !== 'object') {
    return registryError(
      'AI_ACTION_INVALID_INPUT_SCHEMA',
      'Action input schema must be JSON-compatible.'
    )
  }

  if (ancestors.has(value)) {
    return registryError(
      'AI_ACTION_INVALID_INPUT_SCHEMA',
      'Action input schema must not contain cycles.'
    )
  }

  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      const result: AiJsonValue[] = []

      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          return registryError(
            'AI_ACTION_INVALID_INPUT_SCHEMA',
            'Action input schema must not contain sparse arrays.'
          )
        }

        result.push(detachJsonValue(value[index], ancestors))
      }

      return Object.freeze(result)
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      return registryError(
        'AI_ACTION_INVALID_INPUT_SCHEMA',
        'Action input schema must contain only plain JSON objects.'
      )
    }

    const result: Record<string, AiJsonValue> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: detachJsonValue(nestedValue, ancestors),
        writable: true
      })
    }

    return Object.freeze(result)
  } finally {
    ancestors.delete(value)
  }
}

class DefaultAiActionRegistry implements AiActionRegistry {
  private readonly actions = new Map<
    string,
    AiActionDefinition<unknown, AiActionResult>
  >()
  private readonly descriptions = new Map<string, AiActionDescription>()
  private disposed = false

  register(action: AiActionDefinition): void {
    this.assertActive()

    if (typeof action.name !== 'string' || action.name.trim().length === 0) {
      return registryError(
        'AI_ACTION_INVALID_NAME',
        'Action name must be a non-empty string.'
      )
    }

    if (
      typeof action.description !== 'string' ||
      action.description.trim().length === 0
    ) {
      return registryError(
        'AI_ACTION_INVALID_DESCRIPTION',
        'Action description must be a non-empty string.'
      )
    }

    if (typeof action.execute !== 'function') {
      return registryError(
        'AI_ACTION_INVALID_EXECUTOR',
        'Action executor must be a function.'
      )
    }

    if (this.actions.has(action.name)) {
      return registryError(
        'AI_ACTION_DUPLICATE',
        `Action "${action.name}" is already registered.`
      )
    }

    const inputSchema = detachJsonValue(action.inputSchema)
    const registeredAction: AiActionDefinition<unknown, AiActionResult> =
      Object.freeze({
        description: action.description,
        execute: action.execute,
        inputSchema,
        name: action.name
      })
    const description: AiActionDescription = Object.freeze({
      description: action.description,
      inputSchema,
      name: action.name
    })

    this.actions.set(action.name, registeredAction)
    this.descriptions.set(action.name, description)
  }

  get(name: string): AiActionDefinition | undefined {
    this.assertActive()

    return this.actions.get(name)
  }

  list(): readonly AiActionDescription[] {
    this.assertActive()

    if (this.descriptions.size === 0) {
      return registryError(
        'AI_ACTION_REGISTRY_EMPTY',
        'At least one action must be registered before a provider request.'
      )
    }

    return Object.freeze([...this.descriptions.values()])
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    this.actions.clear()
    this.descriptions.clear()
  }

  private assertActive(): void {
    if (this.disposed) {
      return registryError(
        'AI_ACTION_REGISTRY_DISPOSED',
        'The action registry has been disposed.'
      )
    }
  }
}

export const createAiActionRegistry = (): AiActionRegistry =>
  new DefaultAiActionRegistry()
