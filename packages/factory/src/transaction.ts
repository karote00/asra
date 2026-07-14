import type { AllEvent, TransactionReplayMode } from '@asyra/reactive-events'

export type TransactionInverter = (
  event: AllEvent
) => AllEvent | readonly AllEvent[]

export type TransactionReplayHandler = (
  event: AllEvent,
  mode: TransactionReplayMode
) => boolean | undefined

export interface TransactionValidationContext {
  changeCount: number
  undoableChangeCount: number
  rollbackableChangeCount: number
  nonRollbackableChangeCount: number
}

export interface TransactionValidationFailure {
  valid: false
  code: string
  message: string
}

export type TransactionValidationResult =
  | undefined
  | { valid: true }
  | TransactionValidationFailure

export type TransactionValidator = (
  context: Readonly<TransactionValidationContext>
) => TransactionValidationResult

export class TransactionRollbackError extends Error {
  readonly failures: readonly unknown[]

  constructor(failures: readonly unknown[]) {
    super(`Transaction rollback failed for ${failures.length} journal entry`)
    this.name = 'TransactionRollbackError'
    this.failures = failures
  }
}

export class TransactionValidationError extends Error {
  readonly validatorName: string
  readonly code: string
  readonly validationCause?: unknown

  constructor(
    validatorName: string,
    code: string,
    message: string,
    validationCause?: unknown
  ) {
    super(message)
    this.name = 'TransactionValidationError'
    this.validatorName = validatorName
    this.code = code
    this.validationCause = validationCause
  }
}
