import type { AiTransactionRunner } from '@asyra/ai-agent-runtime'
import { transactionApis } from '../common-apis'

export type AsyraDesignAiTransactionBoundary = <T>(
  execute: () => Promise<T>
) => Promise<T>

const runCommonTransaction: AsyraDesignAiTransactionBoundary = <T>(
  execute: () => Promise<T>
): Promise<T> => transactionApis.runTransaction(execute)

export const createAsyraDesignAiTransactionRunner = (
  runTransaction: AsyraDesignAiTransactionBoundary = runCommonTransaction
): AiTransactionRunner => {
  const runner: AiTransactionRunner = {
    run: async <T>(_label: string, execute: () => Promise<T>): Promise<T> =>
      runTransaction(execute)
  }

  return Object.freeze(runner)
}
