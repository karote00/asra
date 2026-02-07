import type {
  ActiveSession,
  SessionParticipant,
  SessionState
} from '../types/feature'
import type { SystemContextSnapshot } from '@asyra/utils'

/**
 * Session Manager
 * Handles priority-based session coordination for multiple features
 */
export class SessionManager {
  private activeSessions = new Map<string, ActiveSession>()
  private sessionHandlers = new Map<string, SessionParticipant[]>()

  /**
   * Register a session handler for a feature
   * @param sessionName - Name of the session (e.g., 'input.drag')
   * @param featureName - Name of the feature registering
   * @param priority - Execution priority (higher = runs first)
   * @param exclusive - If true, stops lower priority features
   * @param handler - Session lifecycle handlers
   */
  registerSession(
    sessionName: string,
    featureName: string,
    priority: number,
    exclusive: boolean,
    handler: any
  ): void {
    const participant: SessionParticipant = {
      featureName,
      priority,
      exclusive,
      handler,
      state: null
    }

    if (!this.sessionHandlers.has(sessionName)) {
      this.sessionHandlers.set(sessionName, [])
    }

    const handlers = this.sessionHandlers.get(sessionName)!
    handlers.push(participant)

    // Sort by priority (descending) - higher priority runs first
    handlers.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Handle session start with priority-based selection
   * @param sessionName - Name of the session
   * @param snapshot - System context snapshot
   * @returns True if any feature participated
   */
  async handleStart(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<boolean> {
    const handlers = this.sessionHandlers.get(sessionName)
    if (!handlers || handlers.length === 0) return false

    // Priority-ordered: check features from highest to lowest priority
    const participants: SessionParticipant[] = []
    let exclusiveFound = false

    for (const participant of handlers) {
      // Skip if previous exclusive feature stopped us
      if (exclusiveFound) break

      try {
        // Call onStart handler
        const state = await participant.handler.onStart?.(snapshot)

        if (state !== null && state !== undefined) {
          // Feature participates
          participants.push({
            ...participant,
            state
          })

          // If exclusive, stop checking lower priorities
          if (participant.exclusive) {
            exclusiveFound = true
          }
        }
      } catch (error) {
        console.error(
          `Feature "${participant.featureName}" error in onStart:`,
          error
        )
        // Continue with next feature on error
      }
    }

    if (participants.length === 0) {
      return false // No participants
    }

    // Create active session
    const activeSession: ActiveSession = {
      name: sessionName,
      participants,
      startTime: Date.now(),
      states: new Map()
    }

    participants.forEach((p) => {
      // Use p.featureName as the key, not p.name which doesn't exist
      activeSession.states.set(p.featureName, p.state!)
    })

    this.activeSessions.set(sessionName, activeSession)
    return true
  }

  /**
   * Handle session update (only for participants)
   * @param sessionName - Name of the session
   * @param snapshot - System context snapshot
   */
  async handleUpdate(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    const session = this.activeSessions.get(sessionName)
    if (!session) return

    // Call onUpdate for all participants (original priority order)
    for (const participant of session.participants) {
      try {
        const state = session.states.get(participant.featureName)
        if (state !== undefined) {
          await participant.handler.onUpdate?.(snapshot, state)
        }
      } catch (error) {
        console.error(
          `Feature "${participant.featureName}" error in onUpdate:`,
          error
        )
      }
    }
  }

  /**
   * Handle session end (only for participants)
   * @param sessionName - Name of the session
   * @param snapshot - System context snapshot
   */
  async handleEnd(
    sessionName: string,
    snapshot: SystemContextSnapshot
  ): Promise<void> {
    const session = this.activeSessions.get(sessionName)
    if (!session) return

    // Call onEnd for all participants
    for (const participant of session.participants) {
      try {
        const state = session.states.get(participant.featureName)
        if (state !== undefined) {
          await participant.handler.onEnd?.(snapshot, state)
        }
      } catch (error) {
        console.error(
          `Feature "${participant.featureName}" error in onEnd:`,
          error
        )
      }
    }

    // Clear session
    this.activeSessions.delete(sessionName)
  }

  /**
   * Get active session (for debugging)
   * @param sessionName - Name of the session
   * @returns Active session or undefined
   */
  getActiveSession(sessionName: string): ActiveSession | undefined {
    return this.activeSessions.get(sessionName)
  }

  /**
   * Get all registered session names
   * @returns Array of session names
   */
  getRegisteredSessionNames(): string[] {
    return Array.from(this.sessionHandlers.keys())
  }

  /**
   * Get all active sessions
   * @returns Map of session name to active session
   */
  getAllActiveSessions(): Map<string, ActiveSession> {
    return new Map(this.activeSessions)
  }

  /**
   * Clear all sessions (for cleanup)
   */
  clearAll(): void {
    this.activeSessions.clear()
  }

  /**
   * Unregister a session handler
   * @param sessionName - Name of the session
   * @param featureName - Name of the feature
   * @returns True if handler was removed
   */
  unregisterSession(sessionName: string, featureName: string): boolean {
    const handlers = this.sessionHandlers.get(sessionName)
    if (!handlers) return false

    const index = handlers.findIndex((h) => h.featureName === featureName)
    if (index === -1) return false

    handlers.splice(index, 1)

    // Remove session entry if no handlers left
    if (handlers.length === 0) {
      this.sessionHandlers.delete(sessionName)
    }

    return true
  }
}
