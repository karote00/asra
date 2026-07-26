import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiConversationPanel } from '../ai-conversation-panel'
import { createAsyraDesignAiConversationController } from '../../ai/conversation'
import { createAsyraDesignAiConfirmationBroker } from '../../ai/confirmation'

const createPanelHarness = () => {
  const pending = Promise.withResolvers<Record<string, unknown>>()
  const feature = {
    cancel: vi.fn(() => true),
    execute: vi.fn(() => pending.promise)
  }
  const confirmation = createAsyraDesignAiConfirmationBroker()
  const conversation = createAsyraDesignAiConversationController({
    confirmation,
    createConversationId: () => 'panel-conversation',
    feature,
    getElementType: vi.fn()
  })
  return {
    confirmation,
    conversation,
    feature,
    pending
  }
}

describe('Mock AI conversation panel intent boundary', () => {
  afterEach(() => {
    cleanup()
  })

  it('accepts one trimmed draft, stays non-modal, and exposes active cancellation', () => {
    const harness = createPanelHarness()
    const onClose = vi.fn()
    render(
      <AiConversationPanel
        confirmation={harness.confirmation}
        conversation={harness.conversation}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Mock AI')).toBeTruthy()
    expect(screen.getByRole('complementary').getAttribute('aria-modal')).toBe(
      'false'
    )
    const input = screen.getByLabelText('Message Mock AI')
    expect(document.activeElement).toBe(input)
    const send = screen.getByRole('button', { name: 'Send' })
    expect((send as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, {
      target: {
        value: '  畫一個貓臉  '
      }
    })
    fireEvent.click(send)

    expect(harness.feature.execute).toHaveBeenCalledOnce()
    expect(harness.feature.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: '畫一個貓臉'
      })
    )
    expect((input as HTMLTextAreaElement).value).toBe('')
    expect((send as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close Mock AI' }))
    expect(harness.feature.cancel).toHaveBeenCalledWith('panel-closed')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not submit whitespace or queue a second active turn', () => {
    const harness = createPanelHarness()
    render(
      <AiConversationPanel
        confirmation={harness.confirmation}
        conversation={harness.conversation}
        onClose={vi.fn()}
      />
    )
    const input = screen.getByLabelText('Message Mock AI')
    const send = screen.getByRole('button', { name: 'Send' })

    fireEvent.change(input, { target: { value: '   ' } })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByRole('form'))
    expect(harness.feature.execute).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'first' } })
    fireEvent.click(send)
    fireEvent.change(input, { target: { value: 'second' } })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    expect(harness.feature.execute).toHaveBeenCalledOnce()
  })

  it.each([
    ['Allow', true],
    ['Deny', false]
  ] as const)(
    'renders a concise confirmation and routes %s to the broker',
    async (decision, expected) => {
      const harness = createPanelHarness()
      render(
        <AiConversationPanel
          confirmation={harness.confirmation}
          conversation={harness.conversation}
          onClose={vi.fn()}
        />
      )
      harness.confirmation.beginTurn('panel-conversation:turn:1')
      let settlement: Promise<boolean> | undefined
      await act(async () => {
        settlement = harness.confirmation.requestConfirmation(
          {
            actions: [
              {
                arguments: {
                  compositionId: 'secret-group-id'
                },
                id: 'remove-1',
                name: 'remove_ai_composition',
                permission: 'confirm'
              }
            ],
            planId: 'remove-plan'
          },
          {
            signal: new AbortController().signal
          }
        )
      })

      expect(screen.getByText('Delete 1 existing composition.')).toBeTruthy()
      expect(screen.getByText('Destructive')).toBeTruthy()
      expect(screen.getByText('Undoable')).toBeTruthy()
      expect(screen.queryByText(/secret-group-id/)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: decision }))

      await expect(settlement).resolves.toBe(expected)
    }
  )

  it('projects ordered settled progress and a safe result without raw action evidence', async () => {
    const confirmation = createAsyraDesignAiConfirmationBroker()
    const conversation = createAsyraDesignAiConversationController({
      confirmation,
      createConversationId: () => 'panel-progress',
      feature: {
        cancel: vi.fn(() => false),
        execute: vi.fn(async (request) => {
          request.progressObserver({
            attempt: 1,
            phase: 'context',
            summary: 'Understanding the request'
          })
          request.progressObserver({
            actionCount: 1,
            attempt: 1,
            phase: 'execution',
            summary: 'Applying changes'
          })
          return {
            actionResults: [
              {
                actionId: 'secret-action-id',
                actionName: 'insert_vector_composition',
                result: {
                  appliedElementIds: ['secret-canonical-id'],
                  skipped: [],
                  status: 'complete'
                }
              }
            ],
            status: 'executed'
          }
        })
      },
      getElementType: vi.fn()
    })
    render(
      <AiConversationPanel
        confirmation={confirmation}
        conversation={conversation}
        onClose={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Message Mock AI'), {
      target: {
        value: '畫一個貓臉'
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(
      await screen.findByText('Drawing updated successfully.')
    ).toBeTruthy()
    expect(screen.getByText('畫一個貓臉')).toBeTruthy()
    expect(screen.getByText('Understanding the request')).toBeTruthy()
    expect(screen.getByText('Applying changes')).toBeTruthy()
    expect(screen.queryByText('You')).toBeNull()
    expect(screen.getAllByText('Mock AI')).toHaveLength(1)
    expect(screen.queryByText(/secret-action-id/)).toBeNull()
    expect(screen.queryByText(/secret-canonical-id/)).toBeNull()
  })
})
