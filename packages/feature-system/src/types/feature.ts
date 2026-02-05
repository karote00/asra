import type { SystemContextSnapshot } from '@asyra/utils'
import { KeyboardKey, ModifierKey, DetailType } from '@asyra/utils'
import type { ExecutionConfig, ExecutionHandler } from './execution'

export type FeatureKeyMap = string

export interface FeatureDefinition<API = Record<string, any>> {
  name: string
  api?: API
  define: (builder: FeatureBuilder) => void
  metadata?: {
    version?: string
    description?: string
    author?: string
    keyConfig?: string
  }
}

export type FeatureAPI<T = Record<string, any>> = T

export interface FeatureBuilder {
  packages: {
    factory: any
    sceneTree: any
    selection: any
    render: any
    props: any
    systemContext: any
    viewport: any
    inputSystem: any
    interactionCore: any
    core?: any
  }
  events: {
    register: (name: string) => EventRegistration
    emit: (name: string, payload?: unknown, options?: unknown) => void
    subscribe: (name: string, handler: EventHandler) => Subscription
  }
  keys: (combos: KeyCombo[]) => void
  handle: (eventName: string, handler: InteractionHandler) => void
  on: (eventName: string, handler: EventHandler) => void
  importFeature: (featureName: string) => FeatureAPI
  execution: {
    register: (
      eventName: string,
      config?: ExecutionConfig,
      handler?: ExecutionHandler
    ) => void
  }
  session: {
    start: <T>(
      sessionName: string,
      config?: SessionConfig,
      onStart?: any,
      onUpdate?: any,
      onEnd?: any
    ) => void
  }
}

export interface KeyCombo {
  keys: string
  type?: string
  meta?: any
}

export type InteractionHandler = (
  snapshot: SystemContextSnapshot
) => DecisionResult

export interface DecisionResult {
  event?: string
  payload?: unknown
  handler?: EventHandler
}

export type EventHandler = (payload: unknown, options?: unknown) => void

export interface EventRegistration {
  eventName: string
  publish: (payload?: unknown, options?: unknown) => void
  subscribe: (
    handler: (payload?: unknown, options?: unknown) => void
  ) => Subscription
}

export interface Subscription {
  unsubscribe: () => void
}

export interface SessionConfig {
  priority?: number
  exclusive?: boolean
  name?: string
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

export interface SessionHandler<T = SessionState> {
  onStart?: SessionStartHandler<T>
  onUpdate?: SessionUpdateHandler<T>
  onEnd?: SessionEndHandler<T>
}
