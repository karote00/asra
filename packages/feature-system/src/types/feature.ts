import type { SystemContextSnapshot } from '@asyra/utils'
import type { ExecutionHandler } from './execution'

export type FeatureKeyMap = string | undefined

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

export interface SessionHandler<T = SessionState> {
  onStart?: SessionStartHandler<T>
  onUpdate?: SessionUpdateHandler<T>
  onEnd?: SessionEndHandler<T>
}

export interface ActiveSession {
  name: string
  participants: SessionParticipant[]
  startTime: number
  states: Map<string, SessionState>
  abortController?: AbortController
}

export interface SessionParticipant {
  // Runtime data for session execution in SessionManager
  featureName: string
  // Session execution priority (higher = runs first)
  priority: number
  // If true, stops lower priority features from running
  exclusive: boolean
  handler: SessionHandler
  state: SessionState | null
}

export interface FeatureDefinition<API = Record<string, unknown>> {
  // Static configuration for feature registration
  api?: API
  execution?: ExecutionHandler
  session?: {
    start: (snapshot: SystemContextSnapshot) => SessionState | null
    update?: (snapshot: SystemContextSnapshot, state: SessionState) => void
    end?: (snapshot: SystemContextSnapshot, state: SessionState) => void
  }
  // Feature priority for session registration
  priority?: number
  // Whether feature blocks lower priority features
  exclusive?: boolean
}

export type FeatureAPI<T = Record<string, unknown>> = T
