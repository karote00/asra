import type { SystemContextSnapshot } from '@asyra/utils'

export interface ExecutionConfig {
  priority?: number
  exclusive?: boolean
}

export type ExecutionHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot
) => T | null | Promise<T | null>

export interface ExecutionParticipant {
  featureName: string
  priority: number
  exclusive: boolean
  handler: ExecutionHandler
  result: Record<string, unknown> | null
}

export interface ExecutionRegistry {
  register(
    eventName: string,
    featureName: string,
    config: ExecutionConfig,
    handler: ExecutionHandler
  ): void

  execute(eventName: string, snapshot: SystemContextSnapshot): Promise<boolean>

  getHandlers(eventName: string): ExecutionParticipant[]

  unregisterFeature(featureName: string): string[]

  hasHandlers(eventName: string): boolean

  isFeatureActive(featureName: string): boolean
}
