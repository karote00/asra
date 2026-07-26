import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  AsyraDesignAiConfirmationBroker,
  AsyraDesignAiConfirmationSnapshot
} from '../ai/confirmation'
import type {
  AsyraDesignAiConversationController,
  AsyraDesignAiConversationSnapshot
} from '../ai/conversation'
import { summarizeAsyraDesignAiTurn } from '../ai/presentation'

export interface AiConversationPanelProps {
  readonly confirmation: AsyraDesignAiConfirmationBroker
  readonly conversation: AsyraDesignAiConversationController
  readonly onClose: () => void
}

export const AiConversationPanel = ({
  confirmation,
  conversation,
  onClose
}: AiConversationPanelProps) => {
  const conversationBodyRef = useRef<HTMLElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')
  const [conversationSnapshot, setConversationSnapshot] =
    useState<AsyraDesignAiConversationSnapshot>(() =>
      conversation.getSnapshot()
    )
  const [confirmationSnapshot, setConfirmationSnapshot] =
    useState<AsyraDesignAiConfirmationSnapshot>(() =>
      confirmation.getSnapshot()
    )

  useEffect(
    () => conversation.subscribe(setConversationSnapshot),
    [conversation]
  )
  useEffect(
    () => confirmation.subscribe(setConfirmationSnapshot),
    [confirmation]
  )
  useEffect(() => {
    promptRef.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    const body = conversationBodyRef.current
    if (body) {
      body.scrollTop = body.scrollHeight
    }
  }, [confirmationSnapshot, conversationSnapshot])

  const active = conversationSnapshot.activeTurn !== null
  const canSend = draft.trim().length > 0 && !active

  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      const intent = draft.trim()
      if (!intent || conversation.getSnapshot().activeTurn) {
        return
      }
      const settlement = conversation.submit(intent)
      if (conversation.getSnapshot().activeTurn?.intent === intent) {
        setDraft('')
      }
      void settlement.catch(() => undefined)
    },
    [conversation, draft]
  )

  const close = useCallback(() => {
    if (conversation.getSnapshot().activeTurn) {
      conversation.cancel('panel-closed')
    }
    onClose()
  }, [conversation, onClose])

  const pendingConfirmation = confirmationSnapshot.pending

  return (
    <aside
      aria-label="Mock AI conversation"
      aria-modal="false"
      className="fixed bottom-0 right-0 top-10 z-50 flex w-[384px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border-l border-[#45464b] bg-[#202124] text-[#f5f5f5] shadow-[-18px_0_48px_rgba(0,0,0,0.32)]"
      data-testid="mock-ai-panel"
      role="complementary"
    >
      <header className="flex items-center justify-between border-b border-[#38393e] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-lg bg-[#7c5cff] text-[11px] font-bold text-white"
          >
            AI
          </span>
          <div>
            <h2 className="m-0 text-[13px] font-semibold leading-4">Mock AI</h2>
            <p className="m-0 text-[10px] text-[#a8a9b0]">
              Deterministic drawing assistant
            </p>
          </div>
        </div>
        <button
          aria-label="Close Mock AI"
          className="grid h-7 w-7 place-items-center rounded-md border-0 bg-transparent text-lg text-[#b8b9c0] hover:bg-[#303136] hover:text-white"
          onClick={close}
          type="button"
        >
          ×
        </button>
      </header>

      <section
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        ref={conversationBodyRef}
      >
        {conversationSnapshot.settledTurns.length === 0 && !active ? (
          <div className="rounded-lg border border-[#393a40] bg-[#27282d] p-3 text-[11px] leading-5 text-[#c9cad0]">
            Try “畫一個貓臉”. You can refine the same objects in later turns.
          </div>
        ) : null}

        {conversationSnapshot.settledTurns.map((turn) => {
          const summary = summarizeAsyraDesignAiTurn(turn)
          return (
            <article
              className="flex flex-col gap-2"
              data-outcome={turn.outcome}
              data-turn-id={turn.turnId}
              key={turn.turnId}
            >
              <div
                aria-label="Your message"
                className="ml-8 rounded-lg rounded-tr-sm bg-[#34353b] px-3 py-2"
              >
                <p className="m-0 text-[11px] leading-5 text-[#f1f1f3]">
                  {turn.intent}
                </p>
              </div>
              <div
                aria-label="Agent response"
                className="mr-5 rounded-lg rounded-tl-sm border border-[#454153] bg-[#29272f] px-3 py-2.5"
              >
                {turn.progress.length > 0 ? (
                  <ol
                    aria-label="Operational progress"
                    className="mb-2 flex list-none flex-col gap-1 p-0"
                  >
                    {turn.progress.map((update, index) => (
                      <li
                        className="flex items-center gap-2 text-[9px] text-[#a9a7b1]"
                        key={`${turn.turnId}:${update.phase}:${index}`}
                      >
                        <span
                          aria-hidden="true"
                          className="h-1 w-1 rounded-full bg-[#8272ce]"
                        />
                        {update.summary}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <p className="m-0 text-[11px] leading-5 text-[#e1dff0]">
                  {summary.message}
                </p>
              </div>
            </article>
          )
        })}

        {active ? (
          <div className="rounded-lg border border-[#514a78] bg-[#29263a] p-3">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-[#ded8ff]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#9f8cff]" />
              Working on your request
            </div>
            <p className="m-0 truncate text-[10px] text-[#aaa5c5]">
              {conversationSnapshot.activeTurn?.intent}
            </p>
            {conversationSnapshot.activeTurn?.progress.length ? (
              <ol
                aria-label="Current operational progress"
                className="mb-0 mt-2 flex list-none flex-col gap-1 border-t border-[#413c5a] pt-2 pl-0"
              >
                {conversationSnapshot.activeTurn.progress.map(
                  (update, index) => (
                    <li
                      className="flex items-center gap-2 text-[9px] text-[#bbb6d1]"
                      key={`${update.phase}:${index}`}
                    >
                      <span
                        aria-hidden="true"
                        className="h-1 w-1 rounded-full bg-[#9f8cff]"
                      />
                      {update.summary}
                    </li>
                  )
                )}
              </ol>
            ) : null}
          </div>
        ) : null}

        {pendingConfirmation ? (
          <div
            aria-label="AI action confirmation"
            className="rounded-lg border border-[#7b5b38] bg-[#30281f] p-3"
          >
            <p className="m-0 text-[11px] font-semibold text-[#ffd7a3]">
              Confirm action
            </p>
            <p className="mb-2 mt-1 text-[11px] leading-5 text-[#e8dfd3]">
              {pendingConfirmation.summary.message}
            </p>
            <div className="mb-3 flex gap-1.5 text-[9px] uppercase tracking-wide">
              {pendingConfirmation.summary.destructive ? (
                <span className="rounded bg-[#5a3028] px-1.5 py-0.5 text-[#ffb3a3]">
                  Destructive
                </span>
              ) : null}
              <span className="rounded bg-[#3c3a32] px-1.5 py-0.5 text-[#d8d1b6]">
                Undoable
              </span>
              <span className="rounded bg-[#31363a] px-1.5 py-0.5 text-[#b9c5cd]">
                No external effect
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-[#5a5b62] bg-transparent px-3 py-1.5 text-[10px] text-[#dadbe0] hover:bg-[#37383d]"
                onClick={() => confirmation.resolve(false)}
                type="button"
              >
                Deny
              </button>
              <button
                className="rounded-md border border-[#8d7bff] bg-[#745cff] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-[#856fff]"
                onClick={() => confirmation.resolve(true)}
                type="button"
              >
                Allow
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <form
        aria-label="Mock AI message form"
        className="border-t border-[#38393e] p-3"
        onSubmit={submit}
      >
        <label className="sr-only" htmlFor="mock-ai-message">
          Message Mock AI
        </label>
        <textarea
          aria-label="Message Mock AI"
          className="min-h-[72px] w-full resize-none rounded-lg border border-[#46474e] bg-[#18191c] px-3 py-2 text-[11px] leading-5 text-white outline-none placeholder:text-[#777982] focus:border-[#806cff]"
          data-ai-agent-prompt="true"
          disabled={active}
          id="mock-ai-message"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Describe a drawing or refinement…"
          ref={promptRef}
          value={draft}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px] text-[#81838b]">
            Mock mode · no API key
          </span>
          <div className="flex items-center gap-2">
            {active ? (
              <button
                aria-label="Cancel request"
                className="rounded-md border border-[#6c4d4d] bg-[#382727] px-3 py-1.5 text-[10px] text-[#ffb8b8] hover:bg-[#472e2e]"
                onClick={() => conversation.cancel('user-cancelled')}
                type="button"
              >
                Cancel
              </button>
            ) : null}
            <button
              className="rounded-md border border-[#8d7bff] bg-[#745cff] px-3 py-1.5 text-[10px] font-medium text-white enabled:hover:bg-[#856fff] disabled:cursor-not-allowed disabled:border-[#44454b] disabled:bg-[#303136] disabled:text-[#777982]"
              disabled={!canSend}
              type="submit"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </aside>
  )
}
