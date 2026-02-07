/**
 * Session Manager types
 * Defines the session configuration and participant structures
 */

// Re-export session types from feature.ts to avoid circular dependencies
export type {
  SessionStartHandler,
  SessionUpdateHandler,
  SessionEndHandler,
  SessionState,
  ActiveSession,
  SessionParticipant
} from './feature'

// Additional session-specific types can be added here if needed
