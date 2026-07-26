import { describe, expect, it } from 'vitest'
import { summarizeAsyraDesignAiTurn } from '../presentation'

const turn = (
  outcome:
    | 'cancelled'
    | 'failed'
    | 'no-change'
    | 'partial'
    | 'success'
    | 'unavailable'
) => ({
  conversationId: 'conversation-a',
  intent: 'request',
  outcome,
  progress: [],
  result: {
    actionResults: [
      {
        actionId: 'secret-action-id',
        actionName: 'secret-action-name',
        result: {
          appliedElementIds: ['secret-canonical-id'],
          skipped: [{ reason: 'secret-reason' }],
          status: outcome === 'partial' ? 'partial' : 'complete'
        }
      }
    ],
    providerBody: 'secret-provider-body',
    status: 'executed'
  },
  turnId: 'conversation-a:turn:1'
})

describe('Asyra Design AI presentation summaries', () => {
  it('uses distinct safe summaries for every terminal outcome', () => {
    const summaries = [
      'success',
      'partial',
      'no-change',
      'cancelled',
      'unavailable',
      'failed'
    ].map((outcome) =>
      summarizeAsyraDesignAiTurn(turn(outcome as Parameters<typeof turn>[0]))
    )

    expect(summaries.map((summary) => summary.message)).toEqual([
      'Drawing updated successfully.',
      'Partially updated the drawing: 1 applied, 1 skipped.',
      'No canvas changes were needed.',
      'The request was cancelled.',
      'Mock AI is unavailable.',
      'The request failed without applying changes.'
    ])
    expect(new Set(summaries.map((summary) => summary.message))).toHaveProperty(
      'size',
      6
    )
    expect(JSON.stringify(summaries)).not.toMatch(
      /secret-action|secret-canonical|secret-provider|secret-reason/
    )
  })
})
