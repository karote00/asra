import type { AiTransactionRunner } from '@asyra/ai-agent-runtime'
import { measureBrowserDragAsyncPhase } from '@asyra/utils'
import { transactionApis } from '../common-apis'
import type { AsyraDesignAiHistoryProjection } from '../common-apis/history'

export type AsyraDesignAiTransactionBoundary = <T>(
  execute: () => Promise<T>
) => Promise<T>

const runCommonTransaction: AsyraDesignAiTransactionBoundary = <T>(
  execute: () => Promise<T>
): Promise<T> => transactionApis.runTransaction(execute)

export const createAsyraDesignAiTransactionRunner = (
  runTransaction: AsyraDesignAiTransactionBoundary = runCommonTransaction,
  history?: Pick<
    AsyraDesignAiHistoryProjection,
    'correlateCommittedAction' | 'getCurrentActionId'
  >
): AiTransactionRunner => {
  const runner: AiTransactionRunner = {
    run: async <T>(_label: string, execute: () => Promise<T>): Promise<T> => {
      return measureBrowserDragAsyncPhase('ai-app:transaction', async () => {
        const actionIdBefore = history?.getCurrentActionId() ?? null
        const result = await runTransaction(() =>
          measureBrowserDragAsyncPhase('ai-app:transaction-execute', execute)
        )
        const actionIdAfter = history?.getCurrentActionId() ?? null
        if (actionIdAfter !== null && actionIdAfter !== actionIdBefore) {
          history?.correlateCommittedAction(actionIdAfter)
        }
        return result
      })
    }
  }

  return Object.freeze(runner)
}
