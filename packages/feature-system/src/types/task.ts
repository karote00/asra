export interface FeatureTaskContext {
  readonly signal: AbortSignal
}

export type FeatureTaskHandler<Input = unknown, Result = unknown> = (
  input: Input,
  context: FeatureTaskContext
) => Result | Promise<Result>

export interface InvokeFeatureTaskOptions {
  signal?: AbortSignal
}

export interface FeatureTaskRegistration {
  readonly priority: number
  readonly exclusive: boolean
  readonly handler: FeatureTaskHandler
}
