import type { AiTransactionRunner } from '@asyra/ai-agent-runtime'
import { measureBrowserDragAsyncPhase } from '@asyra/utils'
import { transactionApis } from '../common-apis'
import type { AsyraDesignAiHistoryProjection } from '../common-apis/history'
import {
  asyraDesignDocumentInteractionLock,
  type AsyraDesignDocumentInteractionLock
} from './document-interaction-lock'

export type AsyraDesignAiTransactionBoundary = <T>(
  execute: () => Promise<T>
) => Promise<T>

const runCommonTransaction: AsyraDesignAiTransactionBoundary = <T>(
  execute: () => Promise<T>
): Promise<T> => transactionApis.runTransaction(execute)

export interface CreateAsyraDesignAiTransactionRunnerOptions {
  readonly history?: Pick<
    AsyraDesignAiHistoryProjection,
    'correlateCommittedAction' | 'getCurrentActionId'
  >
  readonly interactionLock?: Pick<AsyraDesignDocumentInteractionLock, 'acquire'>
  readonly runTransaction?: AsyraDesignAiTransactionBoundary
}

export const createAsyraDesignAiTransactionRunner = (
  options: CreateAsyraDesignAiTransactionRunnerOptions = {}
): AiTransactionRunner => {
  const {
    history,
    interactionLock = asyraDesignDocumentInteractionLock,
    runTransaction = runCommonTransaction
  } = options
  const runner: AiTransactionRunner = {
    run: async <T>(_label: string, execute: () => Promise<T>): Promise<T> => {
      const releaseInteractionLock = interactionLock.acquire()
      try {
        return await measureBrowserDragAsyncPhase(
          'ai-app:transaction',
          async () => {
            const actionIdBefore = history?.getCurrentActionId() ?? null
            const result = await runTransaction(() =>
              measureBrowserDragAsyncPhase(
                'ai-app:transaction-execute',
                execute
              )
            )
            const actionIdAfter = history?.getCurrentActionId() ?? null
            if (actionIdAfter !== null && actionIdAfter !== actionIdBefore) {
              history?.correlateCommittedAction(actionIdAfter)
            }
            return result
          }
        )
      } finally {
        releaseInteractionLock()
      }
    }
  }

  return Object.freeze(runner)
}
