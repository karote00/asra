import type { SystemContextSnapshot } from '@asyra/utils'
import type { ExecutionConfig, ExecutionHandler } from './execution'

export type FeatureKeyMap = string | undefined

export interface SessionConfig {
  priority?: number
  exclusive?: boolean
}

export type SessionStartHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot
) => T | null

export type SessionUpdateHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot,
  state: T
) => void

export type SessionEndHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot,
  state: T
) => void

export type SessionState = Record<string, unknown>

export type SessionHandler<T = SessionState> = {
  onStart?: SessionStartHandler<T>
  onUpdate?: SessionUpdateHandler<T>
  onEnd?: SessionEndHandler<T>
}

export interface ActiveSession {
  name: string
  participants: SessionParticipant[]
  startTime: number
  states: Map<string, SessionState>
}

export interface SessionParticipant {
  featureName: string
  priority: number
  exclusive: boolean
  handler: SessionHandler
  state: SessionState | null
}

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
}

export type FeatureAPI<T = Record<string, any>> = T
