import type { SystemContextSnapshot } from '@asyra/utils'
import type { ExecutionConfig, ExecutionHandler } from './execution'

export type FeatureKeyMap = string | undefined

export interface FeatureDefinition<API = Record<string, any>> {
  api?: API
  execution?: ExecutionHandler
  session?: {
    start: (snapshot: SystemContextSnapshot) => any | null
    update?: (snapshot: SystemContextSnapshot, state: any) => void
    end?: (snapshot: SystemContextSnapshot, state: any) => void
  }
  priority?: number
  exclusive?: boolean
  metadata?: {
    version?: string
    description?: string
    author?: string
    keyConfig?: FeatureKeyMap
  }
}

export type FeatureAPI<T = Record<string, any>> = T
