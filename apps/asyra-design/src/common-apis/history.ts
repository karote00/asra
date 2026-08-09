/**
 * History/Undo-Redo APIs
 * Used in: undo-redo feature, data-change, and other features needing history control
 */

import {
  redoWithRenderPolicy,
  subscribeToRedo,
  subscribeToUndo,
  subscribeToUserActionCompleted,
  undoWithRenderPolicy,
  type CooperativeRenderOptions
} from '@asyra/core'

export const historyApis = {
  /**
   * Undo the last action
   */
  undo: (options?: CooperativeRenderOptions): Promise<void> =>
    undoWithRenderPolicy(options),

  /**
   * Redo the previously undone action
   */
  redo: (options?: CooperativeRenderOptions): Promise<void> =>
    redoWithRenderPolicy(options)
}

export interface AiHistoryControl {
  readonly actionId: number
  readonly direction: 'redo' | 'undo'
  readonly turnId: string
}

export interface AiHistorySnapshot {
  readonly control: AiHistoryControl | null
  readonly disposed: boolean
  readonly replaying: boolean
}

interface AiHistoryProjectionDependencies {
  readonly redo: () => Promise<void>
  readonly subscribeToActions: (
    observer: (actionId: number) => void
  ) => () => void
  readonly subscribeToRedo: (observer: () => void) => () => void
  readonly subscribeToUndo: (observer: () => void) => () => void
  readonly undo: () => Promise<void>
}

const defaultAiHistoryDependencies: AiHistoryProjectionDependencies = {
  redo: historyApis.redo,
  subscribeToActions: (observer) => {
    const subscription = subscribeToUserActionCompleted((event) => {
      observer(event.payload.actionId)
    })
    return () => subscription.unsubscribe()
  },
  subscribeToRedo: (observer) => {
    const subscription = subscribeToRedo(observer)
    return () => subscription.unsubscribe()
  },
  subscribeToUndo: (observer) => {
    const subscription = subscribeToUndo(observer)
    return () => subscription.unsubscribe()
  },
  undo: historyApis.undo
}

export const createAiHistoryProjection = (
  dependencies: AiHistoryProjectionDependencies = defaultAiHistoryDependencies
) => {
  const observers = new Set<(snapshot: AiHistorySnapshot) => void>()
  let activeTurnId: string | null = null
  let control: AiHistoryControl | null = null
  let currentActionId: number | null = null
  let disposed = false
  let replaying = false

  const getSnapshot = (): AiHistorySnapshot =>
    Object.freeze({
      control,
      disposed,
      replaying
    })

  const notify = () => {
    const snapshot = getSnapshot()
    observers.forEach((observer) => {
      try {
        observer(snapshot)
      } catch {
        // Presentation observers cannot affect canonical history.
      }
    })
  }

  const setControl = (next: AiHistoryControl | null) => {
    control = next ? Object.freeze({ ...next }) : null
    notify()
  }

  const unsubscribeActions = dependencies.subscribeToActions((actionId) => {
    currentActionId = actionId
    if (control && control.actionId !== actionId) {
      setControl(null)
    }
  })
  const unsubscribeUndo = dependencies.subscribeToUndo(() => {
    if (control?.direction === 'undo') {
      setControl({
        ...control,
        direction: 'redo'
      })
    } else if (control?.direction === 'redo') {
      setControl(null)
    }
  })
  const unsubscribeRedo = dependencies.subscribeToRedo(() => {
    if (control?.direction === 'redo') {
      setControl({
        ...control,
        direction: 'undo'
      })
    }
  })

  return Object.freeze({
    beginTurn: (turnId: string): void => {
      if (!disposed) {
        activeTurnId = turnId
      }
    },
    correlateCommittedAction: (actionId: number): boolean => {
      if (
        disposed ||
        !activeTurnId ||
        currentActionId === null ||
        currentActionId !== actionId
      ) {
        return false
      }
      setControl({
        actionId,
        direction: 'undo',
        turnId: activeTurnId
      })
      return true
    },
    dispose: (): void => {
      if (disposed) {
        return
      }
      disposed = true
      activeTurnId = null
      control = null
      replaying = false
      observers.clear()
      unsubscribeActions()
      unsubscribeUndo()
      unsubscribeRedo()
    },
    endTurn: (turnId: string): void => {
      if (activeTurnId === turnId) {
        activeTurnId = null
      }
    },
    getCurrentActionId: (): number | null => currentActionId,
    getSnapshot,
    redoCurrent: async (): Promise<boolean> => {
      if (disposed || replaying || control?.direction !== 'redo') {
        return false
      }
      replaying = true
      notify()
      try {
        await dependencies.redo()
        return true
      } finally {
        replaying = false
        notify()
      }
    },
    subscribe: (
      observer: (snapshot: AiHistorySnapshot) => void
    ): (() => void) => {
      if (disposed) {
        return () => undefined
      }
      observers.add(observer)
      try {
        observer(getSnapshot())
      } catch {
        // Presentation observers cannot affect canonical history.
      }
      return () => {
        observers.delete(observer)
      }
    },
    undoCurrent: async (): Promise<boolean> => {
      if (disposed || replaying || control?.direction !== 'undo') {
        return false
      }
      replaying = true
      notify()
      try {
        await dependencies.undo()
        return true
      } finally {
        replaying = false
        notify()
      }
    }
  })
}

export type AiHistoryProjection = ReturnType<typeof createAiHistoryProjection>
