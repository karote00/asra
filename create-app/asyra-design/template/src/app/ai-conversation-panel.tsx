import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent
} from 'react'
import type {
  AsyraDesignAiConfirmationBroker,
  AsyraDesignAiConfirmationSnapshot
} from '../ai/confirmation'
import type {
  AsyraDesignAiConversationController,
  AsyraDesignAiConversationSnapshot,
  AsyraDesignAiImageAttachment,
  AsyraDesignAiImageMediaType
} from '../ai/conversation'
import {
  projectAsyraDesignAiDrawingDetailChoice,
  summarizeAsyraDesignAiTurn,
  type AsyraDesignAiDrawingDetailChoice,
  type AsyraDesignAiDrawingDetailOptionId
} from '../ai/presentation'
import {
  AsyraDesignAiDrawingDetailOptionIds,
  AsyraDesignAiDrawingDetailSelectionIntents
} from '../constants'

const ACCEPTED_IMAGE_TYPES = new Set<AsyraDesignAiImageMediaType>([
  'image/jpeg',
  'image/png',
  'image/webp'
])

const DRAWING_DETAIL_SELECTION_INTENTS: Readonly<
  Record<AsyraDesignAiDrawingDetailOptionId, string>
> = Object.freeze({
  [AsyraDesignAiDrawingDetailOptionIds.BALANCED]:
    AsyraDesignAiDrawingDetailSelectionIntents.BALANCED_ZH,
  [AsyraDesignAiDrawingDetailOptionIds.MAXIMUM]:
    AsyraDesignAiDrawingDetailSelectionIntents.MAXIMUM_ZH
})

const readImageAttachment = (
  file: File
): Promise<AsyraDesignAiImageAttachment> =>
  new Promise((resolve, reject) => {
    const mediaType = file.type as AsyraDesignAiImageMediaType
    const reader = new FileReader()
    reader.onerror = () => {
      reject(new Error('image-read-failed'))
    }
    reader.onload = () => {
      if (
        typeof reader.result !== 'string' ||
        !reader.result.startsWith(`data:${mediaType};base64,`)
      ) {
        reject(new Error('image-read-failed'))
        return
      }
      resolve(
        Object.freeze({
          dataUrl: reader.result,
          mediaType,
          name: file.name,
          size: file.size
        })
      )
    }
    reader.readAsDataURL(file)
  })

const ImageAttachmentStrip = ({
  attachments,
  onRemove
}: {
  readonly attachments: readonly AsyraDesignAiImageAttachment[]
  readonly onRemove?: (index: number) => void
}) => (
  <ul
    aria-label="Attached images"
    className="m-0 flex list-none gap-2 overflow-x-auto p-0"
  >
    {attachments.map((attachment, index) => (
      <li
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[#4a4b52] bg-[#111216]"
        key={`${attachment.name}:${attachment.size}:${index}`}
      >
        <img
          alt={attachment.name}
          className="h-full w-full object-cover"
          src={attachment.dataUrl}
        />
        {onRemove ? (
          <button
            aria-label={`Remove ${attachment.name}`}
            className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-black/75 text-[12px] leading-none text-white hover:bg-black"
            onClick={() => onRemove(index)}
            type="button"
          >
            ×
          </button>
        ) : null}
      </li>
    ))}
  </ul>
)

const DrawingDetailChoiceCard = ({
  choice,
  onChoose
}: {
  readonly choice: AsyraDesignAiDrawingDetailChoice
  readonly onChoose?: () => void
}) => {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="m-0 text-[11px] font-semibold text-[#f0edff]">
          {choice.label}
        </p>
        <span className="shrink-0 rounded bg-[#383443] px-1.5 py-0.5 text-[8px] uppercase tracking-wide text-[#c7bfff]">
          {choice.id}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[9px] leading-4 text-[#b9b6c4]">
        <span>
          {choice.elementCount.toLocaleString('en-US')} editable elements
        </span>
        <span>{choice.pointCountLabel}</span>
      </div>
      <p className="mb-0 mt-1 text-[9px] leading-4 text-[#aaa6b3]">
        {choice.description}
      </p>
      {choice.resourceWarning ? (
        <p className="mb-0 mt-1.5 rounded bg-[#3a2f24] px-2 py-1.5 text-[9px] leading-4 text-[#f1c58f]">
          {choice.resourceWarning}
        </p>
      ) : null}
    </>
  )

  return (
    <li>
      {onChoose ? (
        <button
          aria-label={`Choose ${choice.label}`}
          className="w-full rounded-md border border-[#56506d] bg-[#222127] p-2.5 text-left transition-colors hover:border-[#8073b5] hover:bg-[#292633] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9b87ff]"
          onClick={onChoose}
          type="button"
        >
          {content}
        </button>
      ) : (
        <div className="rounded-md border border-[#4b4857] bg-[#222127] p-2.5">
          {content}
        </div>
      )}
    </li>
  )
}

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
  const imageInputRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')
  const [draftAttachments, setDraftAttachments] = useState<
    readonly AsyraDesignAiImageAttachment[]
  >([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [draggingImages, setDraggingImages] = useState(false)
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

  const addImageFiles = useCallback(
    async (files: FileList | readonly File[]) => {
      if (conversation.getSnapshot().activeTurn) {
        return
      }
      const selectedFiles = Array.from(files)
      const acceptedFiles = selectedFiles.filter((file) =>
        ACCEPTED_IMAGE_TYPES.has(file.type as AsyraDesignAiImageMediaType)
      )
      setAttachmentError(
        acceptedFiles.length === selectedFiles.length
          ? null
          : 'Choose PNG, JPEG, or WebP images.'
      )
      if (acceptedFiles.length === 0) {
        return
      }
      const results = await Promise.allSettled(
        acceptedFiles.map(readImageAttachment)
      )
      if (conversation.getSnapshot().activeTurn) {
        return
      }
      const attachments = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : []
      )
      if (attachments.length > 0) {
        setDraftAttachments((current) =>
          Object.freeze([...current, ...attachments])
        )
      }
      if (results.some((result) => result.status === 'rejected')) {
        setAttachmentError(
          'Could not read one or more images. Try adding them again.'
        )
      }
    },
    [conversation]
  )

  const chooseImages = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.currentTarget.files
      if (files) {
        void addImageFiles(files)
      }
      event.currentTarget.value = ''
    },
    [addImageFiles]
  )

  const dropImages = useCallback(
    (event: DragEvent<HTMLFormElement>) => {
      event.preventDefault()
      setDraggingImages(false)
      if (!active) {
        void addImageFiles(event.dataTransfer.files)
      }
    },
    [active, addImageFiles]
  )

  const submit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      const intent = draft.trim()
      if (!intent || conversation.getSnapshot().activeTurn) {
        return
      }
      const settlement = conversation.submit({
        attachments: draftAttachments,
        intent
      })
      if (conversation.getSnapshot().activeTurn?.intent === intent) {
        setDraft('')
        setDraftAttachments([])
        setAttachmentError(null)
      }
      void settlement.catch(() => undefined)
    },
    [conversation, draft, draftAttachments]
  )

  const submitDrawingDetailChoice = useCallback(
    (
      turnId: string,
      attachments: readonly AsyraDesignAiImageAttachment[],
      optionId: AsyraDesignAiDrawingDetailOptionId
    ) => {
      const snapshot = conversation.getSnapshot()
      const latestSettled =
        snapshot.settledTurns[snapshot.settledTurns.length - 1]
      if (
        snapshot.disposed ||
        snapshot.activeTurn ||
        latestSettled?.turnId !== turnId ||
        attachments.length === 0
      ) {
        return
      }
      try {
        const settlement = conversation.submit({
          attachments,
          intent: DRAWING_DETAIL_SELECTION_INTENTS[optionId]
        })
        void settlement.catch(() => undefined)
      } catch {
        // The controller remains the authority for active/disposed rejection.
      }
    },
    [conversation]
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
      aria-label="Agent conversation"
      aria-modal="false"
      className="fixed bottom-0 right-0 top-10 z-50 flex w-[384px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border-l border-[#45464b] bg-[#202124] text-[#f5f5f5] shadow-[-18px_0_48px_rgba(0,0,0,0.32)]"
      data-testid="ai-agent-panel"
      role="complementary"
    >
      <header className="flex items-center justify-between border-b border-[#38393e] px-4 py-3">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-lg bg-[#7c5cff] text-[11px] font-bold text-white"
        >
          AI
        </span>
        <button
          aria-label="Close Agent panel"
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
            Add or drop a reference image, then ask the Agent to draw it. You
            can refine the same objects in later turns.
          </div>
        ) : null}

        {conversationSnapshot.settledTurns.map((turn, turnIndex) => {
          const summary = summarizeAsyraDesignAiTurn(turn)
          const drawingDetailChoice =
            projectAsyraDesignAiDrawingDetailChoice(turn)
          const canChooseDrawingDetail =
            drawingDetailChoice !== null &&
            turnIndex === conversationSnapshot.settledTurns.length - 1 &&
            turn.attachments.length > 0 &&
            !active &&
            !conversationSnapshot.disposed
          return (
            <article
              className="flex flex-col gap-2"
              data-outcome={turn.outcome}
              data-testid="ai-agent-message"
              data-turn-id={turn.turnId}
              key={turn.turnId}
            >
              <div
                aria-label="Your message"
                className="ml-8 flex flex-col gap-2 rounded-lg rounded-tr-sm bg-[#34353b] px-3 py-2"
              >
                {turn.attachments.length > 0 ? (
                  <ImageAttachmentStrip attachments={turn.attachments} />
                ) : null}
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
                {drawingDetailChoice ? (
                  <ul
                    aria-label="Drawing detail options"
                    className="mb-0 mt-2 flex list-none flex-col gap-2 p-0"
                  >
                    {drawingDetailChoice.choices.map((choice) => (
                      <DrawingDetailChoiceCard
                        choice={choice}
                        key={choice.id}
                        onChoose={
                          canChooseDrawingDetail
                            ? () =>
                                submitDrawingDetailChoice(
                                  turn.turnId,
                                  turn.attachments,
                                  choice.id
                                )
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                ) : null}
                <p
                  aria-label="Elapsed time"
                  className="mb-0 mt-1 text-[9px] text-[#8f8c9b]"
                >
                  {summary.durationLabel}
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
            {conversationSnapshot.activeTurn?.attachments.length ? (
              <div className="mt-2">
                <ImageAttachmentStrip
                  attachments={conversationSnapshot.activeTurn.attachments}
                />
              </div>
            ) : null}
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
        aria-label="Agent message form"
        className={`border-t p-3 transition-colors ${
          draggingImages ? 'border-[#8d7bff] bg-[#282536]' : 'border-[#38393e]'
        }`}
        data-testid="agent-image-drop-target"
        onDragEnter={(event) => {
          event.preventDefault()
          if (!active) {
            setDraggingImages(true)
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDraggingImages(false)
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={dropImages}
        onSubmit={submit}
      >
        <input
          accept="image/png,image/jpeg,image/webp"
          aria-label="Choose images"
          className="sr-only"
          disabled={active}
          multiple
          onChange={chooseImages}
          ref={imageInputRef}
          type="file"
        />
        {draftAttachments.length > 0 ? (
          <div className="mb-2">
            <ImageAttachmentStrip
              attachments={draftAttachments}
              onRemove={(index) => {
                if (!active) {
                  setDraftAttachments((current) =>
                    Object.freeze(
                      current.filter(
                        (_attachment, attachmentIndex) =>
                          attachmentIndex !== index
                      )
                    )
                  )
                  setAttachmentError(null)
                }
              }}
            />
          </div>
        ) : null}
        {attachmentError ? (
          <p
            className="mb-2 mt-0 rounded-md border border-[#765052] bg-[#342426] px-2 py-1.5 text-[10px] text-[#ffc0c3]"
            role="alert"
          >
            {attachmentError}
          </p>
        ) : null}
        <label className="sr-only" htmlFor="ai-agent-input">
          Message Agent
        </label>
        <textarea
          aria-label="Message Agent"
          className="min-h-[72px] w-full resize-none rounded-lg border border-[#46474e] bg-[#18191c] px-3 py-2 text-[11px] leading-5 text-white outline-none placeholder:text-[#777982] focus:border-[#806cff]"
          data-ai-agent-prompt="true"
          disabled={active}
          id="ai-agent-input"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Describe a drawing or refinement…"
          ref={promptRef}
          value={draft}
        />
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              aria-label="Add image"
              className="rounded-md border border-[#46474e] bg-[#27282d] px-2 py-1.5 text-[10px] text-[#c7c8ce] enabled:hover:border-[#696b74] enabled:hover:bg-[#303136] disabled:cursor-not-allowed disabled:text-[#6f7077]"
              disabled={active}
              onClick={() => imageInputRef.current?.click()}
              type="button"
            >
              + Image
            </button>
            <span className="text-[9px] text-[#81838b]">Agent ready</span>
          </div>
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
