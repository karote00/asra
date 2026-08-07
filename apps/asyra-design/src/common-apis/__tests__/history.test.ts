import { describe, expect, it, vi } from 'vitest'
import { createAiHistoryProjection } from '../history'

const createHistoryHarness = () => {
  const actionObservers = new Set<(actionId: number) => void>()
  const undoObservers = new Set<() => void>()
  const redoObservers = new Set<() => void>()
  const unsubscribeAction = vi.fn()
  const unsubscribeUndo = vi.fn()
  const unsubscribeRedo = vi.fn()
  const undo = vi.fn(async () => {
    undoObservers.forEach((observer) => observer())
  })
  const redo = vi.fn(async () => {
    redoObservers.forEach((observer) => observer())
  })
  const projection = createAiHistoryProjection({
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

describe('Design App current AI history projection', () => {
  it('correlates only the active turn commit and invokes canonical Undo or Redo', async () => {
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
      disposed: false,
      replaying: false
    })

    await expect(harness.projection.undoCurrent()).resolves.toBe(true)
    expect(harness.undo).toHaveBeenCalledOnce()
    expect(harness.projection.getSnapshot().control).toMatchObject({
      actionId: 41,
      direction: 'redo'
    })

    await expect(harness.projection.redoCurrent()).resolves.toBe(true)
    expect(harness.redo).toHaveBeenCalledOnce()
    expect(harness.projection.getSnapshot().control).toMatchObject({
      actionId: 41,
      direction: 'undo'
    })
  })

  it('removes stale AI control after a later action or a second undo', async () => {
    const harness = createHistoryHarness()
    harness.projection.beginTurn('conversation-a:turn:1')
    harness.emitAction(10)
    harness.projection.correlateCommittedAction(10)

    harness.emitAction(11)
    expect(harness.projection.getSnapshot().control).toBeNull()
    await expect(harness.projection.undoCurrent()).resolves.toBe(false)
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
      disposed: true,
      replaying: false
    })
    harness.unsubscribers.forEach((unsubscribe) => {
      expect(unsubscribe).toHaveBeenCalledOnce()
    })
  })

  it('keeps one progressive history request pending and rejects a concurrent replay', async () => {
    const actionObservers = new Set<(actionId: number) => void>()
    const undoObservers = new Set<() => void>()
    let releaseUndo: (() => void) | undefined
    const undo = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseUndo = () => {
            undoObservers.forEach((observer) => observer())
            resolve()
          }
        })
    )
    const projection = createAiHistoryProjection({
      redo: vi.fn(async () => undefined),
      subscribeToActions: (observer) => {
        actionObservers.add(observer)
        return () => actionObservers.delete(observer)
      },
      subscribeToRedo: () => () => undefined,
      subscribeToUndo: (observer) => {
        undoObservers.add(observer)
        return () => undoObservers.delete(observer)
      },
      undo
    })
    projection.beginTurn('conversation-a:turn:pending')
    actionObservers.forEach((observer) => observer(91))
    projection.correlateCommittedAction(91)

    const firstRequest = projection.undoCurrent()
    expect(projection.getSnapshot()).toMatchObject({
      control: { actionId: 91, direction: 'undo' },
      replaying: true
    })
    await expect(projection.undoCurrent()).resolves.toBe(false)
    expect(undo).toHaveBeenCalledOnce()

    releaseUndo?.()
    await expect(firstRequest).resolves.toBe(true)
    expect(projection.getSnapshot()).toMatchObject({
      control: { actionId: 91, direction: 'redo' },
      replaying: false
    })
  })
})
