import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignAiHistoryProjection } from '../history'

const createHistoryHarness = () => {
  const actionObservers = new Set<(actionId: number) => void>()
  const undoObservers = new Set<() => void>()
  const redoObservers = new Set<() => void>()
  const unsubscribeAction = vi.fn()
  const unsubscribeUndo = vi.fn()
  const unsubscribeRedo = vi.fn()
  const undo = vi.fn(() => {
    undoObservers.forEach((observer) => observer())
  })
  const redo = vi.fn(() => {
    redoObservers.forEach((observer) => observer())
  })
  const projection = createAsyraDesignAiHistoryProjection({
    redo,
    subscribeToActions: (observer) => {
      actionObservers.add(observer)
      return () => {
        actionObservers.delete(observer)
        unsubscribeAction()
      }
    },
    subscribeToRedo: (observer) => {
      redoObservers.add(observer)
      return () => {
        redoObservers.delete(observer)
        unsubscribeRedo()
      }
    },
    subscribeToUndo: (observer) => {
      undoObservers.add(observer)
      return () => {
        undoObservers.delete(observer)
        unsubscribeUndo()
      }
    },
    undo
  })

  return {
    emitAction: (actionId: number) => {
      actionObservers.forEach((observer) => observer(actionId))
    },
    emitRedo: () => {
      redoObservers.forEach((observer) => observer())
    },
    emitUndo: () => {
      undoObservers.forEach((observer) => observer())
    },
    projection,
    redo,
    undo,
    unsubscribers: [unsubscribeAction, unsubscribeUndo, unsubscribeRedo]
  }
}

describe('Asyra Design current AI history projection', () => {
  it('correlates only the active turn commit and invokes canonical Undo or Redo', () => {
    const harness = createHistoryHarness()
    harness.projection.beginTurn('conversation-a:turn:1')
    harness.emitAction(41)

    expect(harness.projection.correlateCommittedAction(41)).toBe(true)
    expect(harness.projection.getSnapshot()).toEqual({
      control: {
        actionId: 41,
        direction: 'undo',
        turnId: 'conversation-a:turn:1'
      },
      disposed: false
    })

    expect(harness.projection.undoCurrent()).toBe(true)
    expect(harness.undo).toHaveBeenCalledOnce()
    expect(harness.projection.getSnapshot().control).toMatchObject({
      actionId: 41,
      direction: 'redo'
    })

    expect(harness.projection.redoCurrent()).toBe(true)
    expect(harness.redo).toHaveBeenCalledOnce()
    expect(harness.projection.getSnapshot().control).toMatchObject({
      actionId: 41,
      direction: 'undo'
    })
  })

  it('removes stale AI control after a later action or a second undo', () => {
    const harness = createHistoryHarness()
    harness.projection.beginTurn('conversation-a:turn:1')
    harness.emitAction(10)
    harness.projection.correlateCommittedAction(10)

    harness.emitAction(11)
    expect(harness.projection.getSnapshot().control).toBeNull()
    expect(harness.projection.undoCurrent()).toBe(false)
    expect(harness.undo).not.toHaveBeenCalled()

    harness.projection.beginTurn('conversation-a:turn:2')
    harness.emitAction(12)
    harness.projection.correlateCommittedAction(12)
    harness.emitUndo()
    expect(harness.projection.getSnapshot().control?.direction).toBe('redo')
    harness.emitUndo()
    expect(harness.projection.getSnapshot().control).toBeNull()
  })

  it('rejects non-current correlation and tears down instance listeners', () => {
    const harness = createHistoryHarness()
    harness.projection.beginTurn('conversation-a:turn:1')
    harness.emitAction(8)

    expect(harness.projection.correlateCommittedAction(7)).toBe(false)
    expect(harness.projection.getSnapshot().control).toBeNull()

    harness.projection.dispose()
    expect(harness.projection.getSnapshot()).toEqual({
      control: null,
      disposed: true
    })
    harness.unsubscribers.forEach((unsubscribe) => {
      expect(unsubscribe).toHaveBeenCalledOnce()
    })
  })
})
