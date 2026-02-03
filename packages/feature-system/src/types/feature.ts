import type { SystemContextSnapshot } from '@asyra/utils'

/**
 * Feature definition interface
 * Features are self-contained capabilities with public APIs and internal setup
 */
export interface FeatureDefinition<API = Record<string, any>> {
  /** Unique feature name */
  name: string
  /** Public API exposed to other features */
  api?: API
  /** Internal feature setup logic */
  define: (builder: FeatureBuilder) => void
  /** Optional metadata about the feature */
  metadata?: {
    version?: string
    description?: string
    author?: string
  }
}

/** API that features expose to other features */
export type FeatureAPI<T = Record<string, any>> = T

/**
 * Builder provided to feature definitions
 * Gives features access to packages, events, keys, handlers, and sessions
 */
export interface FeatureBuilder {
  /** Package access (injected from core) */
  packages: {
    factory: any
    sceneTree: any
    selection: any
    render: any
    props: any
    systemContext: any
    viewport: any
  }

  /** Event operations */
  events: {
    register: (name: string) => EventRegistration
    emit: (name: string, payload?: unknown, options?: unknown) => void
    subscribe: (name: string, handler: EventHandler) => Subscription
  }

  /** Key combination registration */
  keys: (combos: KeyCombo[]) => void

  /** Interaction handler registration */
  handle: (eventName: string, handler: InteractionHandler) => void

  /** Event subscriber (auto-wiring) */
  on: (eventName: string, handler: EventHandler) => void

  /** Import other features' APIs */
  importFeature: (featureName: string) => FeatureAPI

  /** Session builder */
  session: {
    start: <T>(
      sessionName: string,
      config?: SessionConfig,
      onStart?: SessionStartHandler<T>,
      onUpdate?: SessionUpdateHandler<T>,
      onEnd?: SessionEndHandler<T>
    ) => void
  }
}

/** Supporting types for FeatureBuilder */

export interface KeyCombo {
  keys: string
  type?: string
  meta?: any
}

export type InteractionHandler = {
  (snapshot: SystemContextSnapshot): DecisionResult
}

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

export type Subscription = { unsubscribe: () => void }

// Session types needed before session.ts
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
