export type AiJsonPrimitive = boolean | null | number | string

export type AiJsonValue =
  | AiJsonPrimitive
  | readonly AiJsonValue[]
  | {
      readonly [key: string]: AiJsonValue
    }

export interface AiActionSchemaIssue {
  code: string
  message: string
  path: readonly (number | string)[]
}

export type AiActionSchemaResult<TValue> =
  | {
      success: true
      value: TValue
    }
  | {
      issues: readonly AiActionSchemaIssue[]
      success: false
    }

export interface AiActionSchema<TValue = unknown> {
  providerSchema: unknown
  parse(value: unknown): AiActionSchemaResult<TValue>
}

export interface AiExecutionContext {
  signal: AbortSignal
}

export type AiActionResult = unknown

export interface AiActionDefinition<TArgs = unknown, TResult = AiActionResult> {
  name: string
  description: string
  schema: AiActionSchema<TArgs>
  execute(args: TArgs, context: AiExecutionContext): Promise<TResult>
}

export interface AiActionDescription {
  readonly name: string
  readonly description: string
  readonly inputSchema: AiJsonValue
}

export interface AiActionRegistry {
  register(action: AiActionDefinition): void
  get(name: string): AiActionDefinition | undefined
  list(): readonly AiActionDescription[]
  dispose(): void
}

export type AiActionRegistryErrorCode =
  | 'AI_ACTION_DUPLICATE'
  | 'AI_ACTION_INVALID_DESCRIPTION'
  | 'AI_ACTION_INVALID_EXECUTOR'
  | 'AI_ACTION_INVALID_NAME'
  | 'AI_ACTION_INVALID_SCHEMA'
  | 'AI_ACTION_REGISTRY_DISPOSED'
  | 'AI_ACTION_REGISTRY_EMPTY'
