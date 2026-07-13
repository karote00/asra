export type TransactionReplayMode = 'rollback' | 'undo' | 'redo'

let activeReplayMode: TransactionReplayMode | null = null

export const getTransactionReplayMode = (): TransactionReplayMode | null =>
  activeReplayMode

export const runInTransactionReplayMode = <T>(
  mode: TransactionReplayMode,
  callback: () => T
): T => {
  const previousMode = activeReplayMode
  activeReplayMode = mode
  try {
    return callback()
  } finally {
    activeReplayMode = previousMode
  }
}
