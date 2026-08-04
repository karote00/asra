import type {
  RegistrationDefinitionMetadata,
  SystemContextSnapshot
} from '@asyra/utils'
import type { ExecutionHandler } from './execution.js'
import type { FeatureTaskHandler } from './task.js'

export type FeatureKeyMap = string | undefined

export type SessionStartHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot
) => T | null | Promise<T | null>

export type SessionUpdateHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot,
  state: T
) => void | Promise<void>

export type SessionEndHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot,
  state: T
) => void | Promise<void>

export type SessionCancelPolicy =
  | 'rollback'
  | 'commit-current'
  | 'feature-defined'

export type SessionCancelOutcome = 'rollback' | 'commit-current'

export type SessionCancelHandler<T = Record<string, unknown>> = (
  snapshot: SystemContextSnapshot,
  state: T
) =>
  | SessionCancelOutcome
  | undefined
  | Promise<SessionCancelOutcome | undefined>

export type SessionState = Record<string, unknown>

export interface SessionHandler<T = SessionState> {
  onStart?: SessionStartHandler<T>
  onUpdate?: SessionUpdateHandler<T>
  onEnd?: SessionEndHandler<T>
  onCancel?: SessionCancelHandler<T>
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
  cancelPolicy: SessionCancelPolicy
  handler: SessionHandler
  state: SessionState | null
}

export interface FeatureDefinition<
  API = Record<string, unknown>,
  State = SessionState,
  TaskInput = unknown,
  TaskResult = unknown
> {
  // Static configuration for feature registration
  api?: API
  execution?: ExecutionHandler
  session?: SessionHandler<State>
  task?: FeatureTaskHandler<TaskInput, TaskResult>
  // Feature priority for session registration
  priority?: number
  // Whether feature blocks lower priority features
  exclusive?: boolean
  cancelPolicy?: SessionCancelPolicy
  /** Optional registration-graph metadata owned by the defining package. */
  registration?: RegistrationDefinitionMetadata
}

export type FeatureAPI<T = Record<string, unknown>> = T
