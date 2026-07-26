/**
 * History/Undo-Redo APIs
 * Used in: undo-redo feature, data-change, and other features needing history control
 */

import {
  redo,
  subscribeToRedo,
  subscribeToUndo,
  subscribeToUserActionCompleted,
  undo
} from '@asyra/reactive-events'

export const historyApis = {
  /**
   * Undo the last action
   */
  undo,

  /**
   * Redo the previously undone action
   */
  redo
}

export interface AsyraDesignAiHistoryControl {
  readonly actionId: number
  readonly direction: 'redo' | 'undo'
  readonly turnId: string
}

export interface AsyraDesignAiHistorySnapshot {
  readonly control: AsyraDesignAiHistoryControl | null
  readonly disposed: boolean
}

interface AsyraDesignAiHistoryProjectionDependencies {
  readonly redo: () => void
  readonly subscribeToActions: (
    observer: (actionId: number) => void
  ) => () => void
  readonly subscribeToRedo: (observer: () => void) => () => void
  readonly subscribeToUndo: (observer: () => void) => () => void
  readonly undo: () => void
}

const defaultAiHistoryDependencies: AsyraDesignAiHistoryProjectionDependencies =
  {
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

export const createAsyraDesignAiHistoryProjection = (
  dependencies: AsyraDesignAiHistoryProjectionDependencies = defaultAiHistoryDependencies
) => {
  const observers = new Set<(snapshot: AsyraDesignAiHistorySnapshot) => void>()
  let activeTurnId: string | null = null
  let control: AsyraDesignAiHistoryControl | null = null
  let currentActionId: number | null = null
  let disposed = false

  const getSnapshot = (): AsyraDesignAiHistorySnapshot =>
    Object.freeze({
      control,
      disposed
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

  const setControl = (next: AsyraDesignAiHistoryControl | null) => {
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
    redoCurrent: (): boolean => {
      if (disposed || control?.direction !== 'redo') {
        return false
      }
      dependencies.redo()
      return true
    },
    subscribe: (
      observer: (snapshot: AsyraDesignAiHistorySnapshot) => void
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
    undoCurrent: (): boolean => {
      if (disposed || control?.direction !== 'undo') {
        return false
      }
      dependencies.undo()
      return true
    }
  })
}

export type AsyraDesignAiHistoryProjection = ReturnType<
  typeof createAsyraDesignAiHistoryProjection
>
