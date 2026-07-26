import type {
  AiConfirmationHandler,
  AiPlanPreview
} from '@asyra/ai-agent-runtime'

export type AsyraDesignAiConfirmationRequest = (
  preview: AiPlanPreview,
  options: { signal: AbortSignal }
) => Promise<boolean>

export type AsyraDesignAiConfirmationActionKind =
  | 'create'
  | 'delete'
  | 'mixed'
  | 'modify'
  | 'selection'
  | 'visibility'

export interface AsyraDesignAiConfirmationSummary {
  readonly actionKind: AsyraDesignAiConfirmationActionKind
  readonly affectedCount: number | null
  readonly destructive: boolean
  readonly externalImpact: false
  readonly message: string
  readonly undoable: true
}

export interface AsyraDesignAiPendingConfirmation {
  readonly confirmationId: string
  readonly planId: string
  readonly summary: AsyraDesignAiConfirmationSummary
  readonly turnId: string
}

export interface AsyraDesignAiConfirmationSnapshot {
  readonly activeTurnId: string | null
  readonly disposed: boolean
  readonly pending: AsyraDesignAiPendingConfirmation | null
}

interface PendingConfirmation {
  readonly abort: () => void
  readonly publicValue: AsyraDesignAiPendingConfirmation
  readonly resolve: (accepted: boolean) => void
  readonly signal: AbortSignal
}

const cancelByDefault: AsyraDesignAiConfirmationRequest = async () => false

export const createAsyraDesignAiConfirmationHandler = (
  requestConfirmation: AsyraDesignAiConfirmationRequest = cancelByDefault
): AiConfirmationHandler =>
  Object.freeze({
    confirm: (preview: AiPlanPreview, options: { signal: AbortSignal }) =>
      requestConfirmation(preview, options)
  })

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const countArray = (value: unknown, key: string): number | null => {
  if (!isPlainObject(value) || !Array.isArray(value[key])) {
    return null
  }
  return value[key].length
}

const kindForAction = (
  actionName: string
): Exclude<AsyraDesignAiConfirmationActionKind, 'mixed'> => {
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

const countForAction = (
  actionName: string,
  actionArguments: unknown
): number | null => {
  switch (actionName) {
    case 'insert_vector_composition':
      return countArray(actionArguments, 'items')
    case 'select_elements':
      return countArray(actionArguments, 'elementIds')
    case 'update_composition_elements':
      return countArray(actionArguments, 'updates')
    default:
      return 1
  }
}

const messageForSummary = (
  actionKind: AsyraDesignAiConfirmationActionKind,
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

export const createAsyraDesignAiConfirmationSummary = (
  preview: AiPlanPreview
): AsyraDesignAiConfirmationSummary => {
  const kinds = new Set(
    preview.actions.map((action) => kindForAction(action.name))
  )
  const counts = preview.actions.map((action) =>
    countForAction(action.name, action.arguments)
  )
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

export const createAsyraDesignAiConfirmationBroker = () => {
  const observers = new Set<
    (snapshot: AsyraDesignAiConfirmationSnapshot) => void
  >()
  let activeTurnId: string | null = null
  let disposed = false
  let pending: PendingConfirmation | null = null

  const getSnapshot = (): AsyraDesignAiConfirmationSnapshot =>
    Object.freeze({
      activeTurnId,
      disposed,
      pending: pending?.publicValue ?? null
    })

  const observeSafely = (
    observer: (snapshot: AsyraDesignAiConfirmationSnapshot) => void,
    snapshot: AsyraDesignAiConfirmationSnapshot
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
      preview: AiPlanPreview,
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
            confirmationId: `${activeTurnId}:confirmation`,
            planId: preview.planId,
            summary: createAsyraDesignAiConfirmationSummary(preview),
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
      observer: (snapshot: AsyraDesignAiConfirmationSnapshot) => void
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

export type AsyraDesignAiConfirmationBroker = ReturnType<
  typeof createAsyraDesignAiConfirmationBroker
>
