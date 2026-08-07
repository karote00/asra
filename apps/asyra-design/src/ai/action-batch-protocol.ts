export type AiJsonPrimitive = boolean | null | number | string

export type AiJsonValue =
  | AiJsonPrimitive
  | readonly AiJsonValue[]
  | { readonly [key: string]: AiJsonValue }

export interface AiActionDescription {
  readonly name: string
  readonly description: string
  readonly inputSchema: AiJsonValue
}

export interface AiActionBatchAction {
  readonly id: string
  readonly name: string
  readonly arguments: unknown
  readonly summary: AiJsonValue
}

export interface AiActionBatch {
  readonly batchId: string
  readonly explanation?: string
  readonly actions: readonly AiActionBatchAction[]
}

export interface AiProviderInput<TContext = unknown> {
  readonly intent: string
  readonly context: TContext
  readonly actions: readonly AiActionDescription[]
  readonly attempt: number
  readonly metadata?: AiJsonValue
}
