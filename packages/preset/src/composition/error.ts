import type { PresetApplyErrorCode, PresetDefaultId } from '../types'

export interface PresetApplyErrorDetails {
  readonly cause?: unknown
  readonly defaultId?: PresetDefaultId
  readonly completedCleanup?: readonly string[]
  readonly pendingCleanup?: readonly string[]
}

export class PresetApplyError extends Error {
  readonly code: PresetApplyErrorCode
  readonly cause?: unknown
  readonly defaultId?: PresetDefaultId
  readonly completedCleanup: readonly string[]
  readonly pendingCleanup: readonly string[]

  constructor(
    code: PresetApplyErrorCode,
    message: string,
    details: PresetApplyErrorDetails = {}
  ) {
    super(message)
    this.name = 'PresetApplyError'
    this.code = code
    this.cause = details.cause
    this.defaultId = details.defaultId
    this.completedCleanup = Object.freeze([...(details.completedCleanup ?? [])])
    this.pendingCleanup = Object.freeze([...(details.pendingCleanup ?? [])])
  }
}
