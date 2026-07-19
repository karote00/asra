export const LOAD_HOOK_EXECUTION_ERROR_CODES = {
  ASYNC_UNSUPPORTED: 'ASYNC_UNSUPPORTED',
  INVALID_RESULT: 'INVALID_RESULT'
} as const

export type LoadHookExecutionErrorCode =
  (typeof LOAD_HOOK_EXECUTION_ERROR_CODES)[keyof typeof LOAD_HOOK_EXECUTION_ERROR_CODES]

export class LoadHookExecutionError extends Error {
  readonly name = 'LoadHookExecutionError'

  constructor(
    readonly code: LoadHookExecutionErrorCode,
    readonly hookIndex: number
  ) {
    const reason =
      code === LOAD_HOOK_EXECUTION_ERROR_CODES.ASYNC_UNSUPPORTED
        ? 'returned an unsupported asynchronous result'
        : 'returned an invalid result without a string version'
    super(`[Core] Load hook ${hookIndex} ${reason}`)
  }
}
