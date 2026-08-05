import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_COOPERATIVE_RENDER_MAX_ITEMS_PER_SLICE,
  resolveCooperativeRenderMaxItemsPerSlice,
  settleCooperativeRenderSlice,
  type CooperativeRenderOptions
} from '../cooperative-render.js'
import { subscribeToEvents } from '../event-bus.js'
import { undoWithRenderPolicy } from '../app/publish.js'
import { registerTransactionOwner } from '../transaction-owner.js'
import { EventTypes } from '../types.js'

describe('cooperative render policy', () => {
  it('uses a bounded default item budget and validates explicit overrides', () => {
    expect(resolveCooperativeRenderMaxItemsPerSlice()).toBe(
      DEFAULT_COOPERATIVE_RENDER_MAX_ITEMS_PER_SLICE
    )
    expect(
      resolveCooperativeRenderMaxItemsPerSlice({ maxItemsPerSlice: 64 })
    ).toBe(64)
    expect(() =>
      resolveCooperativeRenderMaxItemsPerSlice({ maxItemsPerSlice: 0 })
    ).toThrow(/positive safe integer/)
  })

  it('defaults to a progressive host yield followed by a paint boundary', async () => {
    const order: string[] = []
    const options: CooperativeRenderOptions = {
      yieldToHost: vi.fn(async () => {
        order.push('host')
      }),
      waitForPaint: vi.fn(async () => {
        order.push('paint')
      })
    }

    await settleCooperativeRenderSlice(options)

    expect(order).toEqual(['host', 'paint'])
  })

  it('allows an explicit atomic opt-out without yielding between phases', async () => {
    const yieldToHost = vi.fn(async () => undefined)
    const waitForPaint = vi.fn(async () => undefined)

    await settleCooperativeRenderSlice({
      mode: 'atomic',
      waitForPaint,
      yieldToHost
    })

    expect(yieldToHost).not.toHaveBeenCalled()
    expect(waitForPaint).not.toHaveBeenCalled()
  })

  it('publishes Undo only after progressive replay and its outer transaction settle', async () => {
    const order: string[] = []
    const owner = {
      startTransaction: vi.fn(() => {
        order.push('start')
      }),
      updateTransactionBatch: vi.fn(),
      endTransaction: vi.fn(() => {
        order.push('end')
      }),
      undo: vi.fn(),
      redo: vi.fn(),
      undoProgressively: vi.fn(async (yieldAfterSlice, _options?: unknown) => {
        order.push('slice-a')
        await yieldAfterSlice()
        order.push('slice-b')
        await yieldAfterSlice()
        order.push('replay-complete')
      }),
      redoProgressively: vi.fn()
    }
    const disposeOwner = registerTransactionOwner(owner)
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UNDO) {
        order.push('undo-event')
      }
    })

    try {
      await undoWithRenderPolicy({
        yieldToHost: async () => {
          order.push('host')
        },
        waitForPaint: async () => {
          order.push('paint')
        }
      })

      expect(order).toEqual([
        'start',
        'slice-a',
        'host',
        'paint',
        'slice-b',
        'host',
        'paint',
        'replay-complete',
        'end',
        'undo-event'
      ])
      expect(owner.undo).not.toHaveBeenCalled()
      expect(owner.undoProgressively.mock.calls[0]?.[1]).toEqual({
        maxItemsPerSlice: DEFAULT_COOPERATIVE_RENDER_MAX_ITEMS_PER_SLICE
      })
    } finally {
      subscription.unsubscribe()
      disposeOwner()
    }
  })

  it('routes an explicit atomic Undo through the synchronous owner path', async () => {
    const owner = {
      startTransaction: vi.fn(),
      updateTransactionBatch: vi.fn(),
      endTransaction: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      undoProgressively: vi.fn(),
      redoProgressively: vi.fn()
    }
    const disposeOwner = registerTransactionOwner(owner)

    try {
      await undoWithRenderPolicy({ mode: 'atomic' })

      expect(owner.undo).toHaveBeenCalledOnce()
      expect(owner.undoProgressively).not.toHaveBeenCalled()
      expect(owner.startTransaction).not.toHaveBeenCalled()
      expect(owner.endTransaction).not.toHaveBeenCalled()
    } finally {
      disposeOwner()
    }
  })
})
