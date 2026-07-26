import { useEffect, useState } from 'react'
import type { AsyraDesignAiConversationController } from '../ai/conversation'
import type {
  AsyraDesignAiHistoryProjection,
  AsyraDesignAiHistorySnapshot
} from '../common-apis/history'
import { summarizeAsyraDesignAiTurn } from '../ai/presentation'

export interface AiHistoryMessageBarProps {
  readonly conversation: AsyraDesignAiConversationController
  readonly history: AsyraDesignAiHistoryProjection
}

export const AiHistoryMessageBar = ({
  conversation,
  history
}: AiHistoryMessageBarProps) => {
  const [conversationSnapshot, setConversationSnapshot] = useState(() =>
    conversation.getSnapshot()
  )
  const [historySnapshot, setHistorySnapshot] =
    useState<AsyraDesignAiHistorySnapshot>(() => history.getSnapshot())

  useEffect(
    () => conversation.subscribe(setConversationSnapshot),
    [conversation]
  )
  useEffect(() => history.subscribe(setHistorySnapshot), [history])

  const control = historySnapshot.control
  if (!control || historySnapshot.disposed) {
    return null
  }

  const turn = conversationSnapshot.settledTurns.find(
    (settled) => settled.turnId === control.turnId
  )
  const message = turn
    ? summarizeAsyraDesignAiTurn(turn).message
    : 'AI drawing change applied.'
  const isUndo = control.direction === 'undo'

  return (
    <aside
      aria-label="Current AI history action"
      className="fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-4 rounded-lg border border-[#4d4e55] bg-[#242529] px-4 py-3 text-[#f4f4f5] shadow-[0_14px_44px_rgba(0,0,0,0.38)]"
      data-action-id={control.actionId}
      data-turn-id={control.turnId}
    >
      <div className="min-w-0">
        <p className="m-0 text-[9px] font-semibold uppercase tracking-wide text-[#a89cff]">
          Mock AI
        </p>
        <p
          aria-live="polite"
          className="m-0 mt-0.5 truncate text-[11px] text-[#e3e3e6]"
          role="status"
        >
          {message}
        </p>
      </div>
      <button
        aria-label={isUndo ? 'Undo AI change' : 'Redo AI change'}
        className="shrink-0 rounded-md border border-[#7668d8] bg-[#6553d7] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-[#7463e1]"
        onClick={() => {
          if (isUndo) {
            history.undoCurrent()
          } else {
            history.redoCurrent()
          }
        }}
        type="button"
      >
        {isUndo ? 'Undo' : 'Redo'}
      </button>
    </aside>
  )
}
