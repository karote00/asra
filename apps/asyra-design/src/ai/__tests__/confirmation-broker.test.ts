import type { AiActionBatchPreview } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { createAiConfirmationBroker } from '../confirmation'

const removalPreview: AiActionBatchPreview = Object.freeze({
  actions: Object.freeze([
    Object.freeze({
      summary: Object.freeze({
        affectedCount: 1
      }),
      id: 'remove-1',
      name: 'remove_ai_composition',
      permission: 'confirm'
    })
  ]),
  explanation: 'Remove the current cat face.',
  batchId: 'remove-batch'
})

describe('Design App AI confirmation broker', () => {
  it('resolves false immediately when no mounted presentation consumer exists', async () => {
    const broker = createAiConfirmationBroker()
    broker.beginTurn('conversation-1:turn:1')

    await expect(
      broker.requestConfirmation(removalPreview, {
        signal: new AbortController().signal
      })
    ).resolves.toBe(false)
    expect(broker.getSnapshot().pending).toBeNull()
  })

  it('projects one concise impact summary without low-level arguments', async () => {
    const broker = createAiConfirmationBroker()
    const snapshots: unknown[] = []
    broker.subscribe((snapshot) => snapshots.push(snapshot))
    broker.beginTurn('conversation-1:turn:1')
    const settlement = broker.requestConfirmation(removalPreview, {
      signal: new AbortController().signal
    })

    expect(broker.getSnapshot().pending).toEqual({
      batchId: 'remove-batch',
      confirmationId: 'conversation-1:turn:1:confirmation',
      summary: {
        actionKind: 'delete',
        affectedCount: 1,
        destructive: true,
        externalImpact: false,
        message: 'Delete 1 existing composition.',
        undoable: true
      },
      turnId: 'conversation-1:turn:1'
    })
    expect(JSON.stringify(snapshots)).not.toMatch(
      /arguments|compositionId|items|paths|points/
    )

    expect(broker.resolve(true)).toBe(true)
    await expect(settlement).resolves.toBe(true)
    expect(broker.resolve(false)).toBe(false)
    expect(broker.getSnapshot().pending).toBeNull()
  })

  it('settles rejection exactly once without retaining the preview', async () => {
    const broker = createAiConfirmationBroker()
    broker.subscribe(() => undefined)
    broker.beginTurn('conversation-2:turn:1')
    const settlement = broker.requestConfirmation(removalPreview, {
      signal: new AbortController().signal
    })

    expect(broker.resolve(false)).toBe(true)
    await expect(settlement).resolves.toBe(false)
    expect(broker.resolve(true)).toBe(false)
    expect(JSON.stringify(broker.getSnapshot())).not.toContain('remove-1')
  })

  it('releases the pending wait and abort listener on Feature abort', async () => {
    const broker = createAiConfirmationBroker()
    broker.subscribe(() => undefined)
    broker.beginTurn('conversation-3:turn:1')
    const controller = new AbortController()
    const removeEventListener = vi.spyOn(
      controller.signal,
      'removeEventListener'
    )
    const settlement = broker.requestConfirmation(removalPreview, {
      signal: controller.signal
    })

    controller.abort('cancelled')

    await expect(settlement).resolves.toBe(false)
    expect(removeEventListener).toHaveBeenCalledWith(
      'abort',
      expect.any(Function)
    )
    expect(broker.getSnapshot().pending).toBeNull()
  })

  it('denies pending work when the panel unmounts or broker disposes', async () => {
    const broker = createAiConfirmationBroker()
    const unsubscribe = broker.subscribe(() => undefined)
    broker.beginTurn('conversation-4:turn:1')
    const unmounted = broker.requestConfirmation(removalPreview, {
      signal: new AbortController().signal
    })

    unsubscribe()
    await expect(unmounted).resolves.toBe(false)

    broker.subscribe(() => undefined)
    broker.beginTurn('conversation-4:turn:2')
    const disposed = broker.requestConfirmation(removalPreview, {
      signal: new AbortController().signal
    })
    await broker.dispose()

    await expect(disposed).resolves.toBe(false)
    expect(broker.getSnapshot()).toEqual({
      activeTurnId: null,
      disposed: true,
      pending: null
    })
  })

  it('keeps confirmation state isolated between mounted app roots', async () => {
    const first = createAiConfirmationBroker()
    const second = createAiConfirmationBroker()
    first.subscribe(() => undefined)
    second.subscribe(() => undefined)
    first.beginTurn('first:turn:1')
    second.beginTurn('second:turn:1')
    const firstSettlement = first.requestConfirmation(removalPreview, {
      signal: new AbortController().signal
    })
    const secondSettlement = second.requestConfirmation(removalPreview, {
      signal: new AbortController().signal
    })

    expect(first.resolve(true)).toBe(true)
    expect(second.resolve(false)).toBe(true)
    await expect(firstSettlement).resolves.toBe(true)
    await expect(secondSettlement).resolves.toBe(false)
  })
})
