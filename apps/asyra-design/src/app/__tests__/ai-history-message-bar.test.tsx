import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiHistoryMessageBar } from '../ai-history-message-bar'

describe('AI current history Message Bar', () => {
  afterEach(() => {
    cleanup()
  })

  it('offers Undo then Redo only for the correlated current AI action', () => {
    interface HistorySnapshot {
      control: {
        actionId: number
        direction: 'redo' | 'undo'
        turnId: string
      } | null
      disposed: boolean
      replaying: boolean
    }
    let historySnapshot: HistorySnapshot = {
      control: null,
      disposed: false,
      replaying: false
    }
    const historyObservers = new Set<(snapshot: HistorySnapshot) => void>()
    const notifyHistory = () => {
      historyObservers.forEach((observer) => observer(historySnapshot))
    }
    const history = {
      getSnapshot: () => historySnapshot,
      redoCurrent: vi.fn(async () => {
        historySnapshot = {
          ...historySnapshot,
          control: historySnapshot.control
            ? {
                ...historySnapshot.control,
                direction: 'undo'
              }
            : null
        }
        notifyHistory()
        return true
      }),
      subscribe: (observer: (snapshot: HistorySnapshot) => void) => {
        historyObservers.add(observer)
        observer(historySnapshot)
        return () => historyObservers.delete(observer)
      },
      undoCurrent: vi.fn(async () => {
        historySnapshot = {
          ...historySnapshot,
          control: historySnapshot.control
            ? {
                ...historySnapshot.control,
                direction: 'redo'
              }
            : null
        }
        notifyHistory()
        return true
      })
    }
    const settledTurn = {
      conversationId: 'conversation-a',
      durationMs: 1_250,
      intent: '畫一個貓臉',
      outcome: 'success',
      progress: [],
      result: {
        actionResults: [
          {
            result: {
              appliedElementIds: ['secret-canonical-id'],
              skipped: [],
              status: 'complete'
            }
          }
        ],
        status: 'executed'
      },
      turnId: 'conversation-a:turn:1'
    }
    const conversationSnapshot = {
      activeTurn: null,
      conversationId: 'conversation-a',
      disposed: false,
      settledTurns: [settledTurn],
      targetHints: {
        compositionId: null,
        roleToElementIds: {}
      }
    }
    const conversation = {
      getSnapshot: () => conversationSnapshot,
      subscribe: vi.fn(
        (observer: (snapshot: typeof conversationSnapshot) => void) => {
          observer(conversationSnapshot)
          return () => undefined
        }
      )
    }
    render(
      <AiHistoryMessageBar
        conversation={conversation as never}
        history={history as never}
      />
    )

    expect(screen.queryByRole('status')).toBeNull()

    act(() => {
      historySnapshot = {
        control: {
          actionId: 31,
          direction: 'undo',
          turnId: 'conversation-a:turn:1'
        },
        disposed: false,
        replaying: false
      }
      notifyHistory()
    })

    expect(screen.getByText('Drawing updated successfully.')).toBeTruthy()
    expect(screen.queryByText(/secret-canonical-id/)).toBeNull()
    act(() => {
      historySnapshot = {
        ...historySnapshot,
        replaying: true
      }
      notifyHistory()
    })
    expect(
      screen.getByRole('button', { name: 'Undo AI change' })
    ).toHaveProperty('disabled', true)
    expect(
      screen
        .getByRole('button', { name: 'Undo AI change' })
        .getAttribute('aria-busy')
    ).toBe('true')
    act(() => {
      historySnapshot = {
        ...historySnapshot,
        replaying: false
      }
      notifyHistory()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Undo AI change' }))
    expect(history.undoCurrent).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Redo AI change' }))
    expect(history.redoCurrent).toHaveBeenCalledOnce()

    act(() => {
      historySnapshot = {
        control: null,
        disposed: false,
        replaying: false
      }
      notifyHistory()
    })
    expect(screen.queryByRole('status')).toBeNull()
  })
})
