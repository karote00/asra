import type {
  AiActionBatchPreview,
  AiConfirmationHandler
} from '@asyra/ai-agent-runtime'

export type AiConfirmationRequest = (
  preview: AiActionBatchPreview,
  options: { signal: AbortSignal }
) => Promise<boolean>

export type AiConfirmationActionKind =
  | 'create'
  | 'delete'
  | 'mixed'
  | 'modify'
  | 'selection'
  | 'visibility'

export interface AiConfirmationSummary {
  readonly actionKind: AiConfirmationActionKind
  readonly affectedCount: number | null
  readonly destructive: boolean
  readonly externalImpact: false
  readonly message: string
  readonly undoable: true
}

export interface AiPendingConfirmation {
  readonly batchId: string
  readonly confirmationId: string
  readonly summary: AiConfirmationSummary
  readonly turnId: string
}

export interface AiConfirmationSnapshot {
  readonly activeTurnId: string | null
  readonly disposed: boolean
  readonly pending: AiPendingConfirmation | null
}

interface PendingConfirmation {
  readonly abort: () => void
  readonly publicValue: AiPendingConfirmation
  readonly resolve: (accepted: boolean) => void
  readonly signal: AbortSignal
}

const cancelByDefault: AiConfirmationRequest = async () => false

export const createAiConfirmationHandler = (
  requestConfirmation: AiConfirmationRequest = cancelByDefault
): AiConfirmationHandler =>
  Object.freeze({
    confirm: (
      preview: AiActionBatchPreview,
      options: { signal: AbortSignal }
    ) => requestConfirmation(preview, options)
  })

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const countForAction = (summary: unknown): number | null => {
  if (!isPlainObject(summary)) {
    return null
  }
  const affectedCount = Object.getOwnPropertyDescriptor(
    summary,
    'affectedCount'
  )
  if (
    !affectedCount?.enumerable ||
    !('value' in affectedCount) ||
    typeof affectedCount.value !== 'number' ||
    !Number.isSafeInteger(affectedCount.value) ||
    affectedCount.value < 0
  ) {
    return null
  }
  return affectedCount.value
}

const kindForAction = (
  actionName: string
): Exclude<AiConfirmationActionKind, 'mixed'> => {
  switch (actionName) {
    case 'insert_vector_composition':
      return 'create'
    case 'remove_ai_composition':
      return 'delete'
    case 'select_elements':
      return 'selection'
    case 'set_element_visibility':
      return 'visibility'
    case 'update_composition_elements':
    default:
      return 'modify'
  }
}

const messageForSummary = (
  actionKind: AiConfirmationActionKind,
  affectedCount: number | null
): string => {
  const count = affectedCount ?? 'the selected'
  switch (actionKind) {
    case 'create':
      return `Create ${count} editable elements.`
    case 'delete':
      return `Delete ${count} existing composition${
        affectedCount === 1 ? '' : 's'
      }.`
    case 'modify':
      return `Modify ${count} existing elements.`
    case 'selection':
      return `Select ${count} existing elements.`
    case 'visibility':
      return `Change visibility for ${count} existing element${
        affectedCount === 1 ? '' : 's'
      }.`
    case 'mixed':
    default:
      return `Apply ${count} bounded changes.`
  }
}

export const createAiConfirmationSummary = (
  preview: AiActionBatchPreview
): AiConfirmationSummary => {
  const kinds = new Set(
    preview.actions.map((action) => kindForAction(action.name))
  )
  const counts = preview.actions.map((action) => countForAction(action.summary))
  const affectedCount = counts.every((count): count is number => count !== null)
    ? counts.reduce((total, count) => total + count, 0)
    : null
  const actionKind =
    kinds.size === 1 ? (kinds.values().next().value ?? 'modify') : 'mixed'
  return Object.freeze({
    actionKind,
    affectedCount,
    destructive: kinds.has('delete'),
    externalImpact: false,
    message: messageForSummary(actionKind, affectedCount),
    undoable: true
  })
}

export const createAiConfirmationBroker = () => {
  const observers = new Set<(snapshot: AiConfirmationSnapshot) => void>()
  let activeTurnId: string | null = null
  let disposed = false
  let pending: PendingConfirmation | null = null

  const getSnapshot = (): AiConfirmationSnapshot =>
    Object.freeze({
      activeTurnId,
      disposed,
      pending: pending?.publicValue ?? null
    })

  const observeSafely = (
    observer: (snapshot: AiConfirmationSnapshot) => void,
    snapshot: AiConfirmationSnapshot
  ) => {
    try {
      observer(snapshot)
    } catch {
      // Presentation observers cannot alter confirmation semantics.
    }
  }

  const notify = () => {
    const snapshot = getSnapshot()
    observers.forEach((observer) => {
      observeSafely(observer, snapshot)
    })
  }

  const settle = (accepted: boolean): boolean => {
    const current = pending
    if (!current) {
      return false
    }
    pending = null
    current.signal.removeEventListener('abort', current.abort)
    current.resolve(accepted)
    notify()
    return true
  }

  const broker = {
    beginTurn: (turnId: string): void => {
      settle(false)
      activeTurnId = turnId
      notify()
    },
    cancel: (_reason?: unknown): boolean => settle(false),
    endTurn: (turnId: string): void => {
      if (activeTurnId !== turnId) {
        return
      }
      settle(false)
      activeTurnId = null
      notify()
    },
    getSnapshot,
    requestConfirmation: (
      preview: AiActionBatchPreview,
      options: { signal: AbortSignal }
    ): Promise<boolean> => {
      if (
        disposed ||
        options.signal.aborted ||
        activeTurnId === null ||
        observers.size === 0
      ) {
        return Promise.resolve(false)
      }
      settle(false)
      return new Promise<boolean>((resolve) => {
        const abort = () => {
          settle(false)
        }
        pending = {
          abort,
          publicValue: Object.freeze({
            batchId: preview.batchId,
            confirmationId: `${activeTurnId}:confirmation`,
            summary: createAiConfirmationSummary(preview),
            turnId: activeTurnId as string
          }),
          resolve,
          signal: options.signal
        }
        options.signal.addEventListener('abort', abort, { once: true })
        notify()
      })
    },
    resolve: (accepted: boolean): boolean => settle(accepted),
    subscribe: (
      observer: (snapshot: AiConfirmationSnapshot) => void
    ): (() => void) => {
      if (disposed) {
        return () => undefined
      }
      observers.add(observer)
      observeSafely(observer, getSnapshot())
      return () => {
        observers.delete(observer)
        if (observers.size === 0) {
          settle(false)
        }
      }
    },
    dispose: async (): Promise<void> => {
      if (disposed) {
        return
      }
      disposed = true
      settle(false)
      activeTurnId = null
      observers.clear()
    }
  }

  return Object.freeze(broker)
}

export type AiConfirmationBroker = ReturnType<typeof createAiConfirmationBroker>
