import type { AiTransactionRunner } from '@asyra/ai-agent-runtime'
import { measureBrowserDragAsyncPhase } from '@asyra/utils'
import { transactionApis } from '../common-apis'
import type { AiHistoryProjection } from '../common-apis/history'
import {
  documentInteractionLock,
  type DocumentInteractionLock
} from './document-interaction-lock'

export type AiTransactionBoundary = <T>(execute: () => Promise<T>) => Promise<T>

const runCommonTransaction: AiTransactionBoundary = <T>(
  execute: () => Promise<T>
): Promise<T> => transactionApis.runTransaction(execute)

export interface CreateAiTransactionRunnerOptions {
  readonly history?: Pick<
    AiHistoryProjection,
    'correlateCommittedAction' | 'getCurrentActionId'
  >
  readonly interactionLock?: Pick<DocumentInteractionLock, 'acquire'>
  readonly runTransaction?: AiTransactionBoundary
}

export const createAiTransactionRunner = (
  options: CreateAiTransactionRunnerOptions = {}
): AiTransactionRunner => {
  const {
    history,
    interactionLock = documentInteractionLock,
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
