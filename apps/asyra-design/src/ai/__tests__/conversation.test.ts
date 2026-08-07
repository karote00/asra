import { describe, expect, it, vi } from 'vitest'
import {
  AiConversationError,
  createAiConversationController,
  type AiConversationFeature
} from '../conversation'
import { createDeferred } from './deferred'

const executed = (
  result: Record<string, unknown>,
  actionName = 'insert_vector_composition'
) => ({
  actionResults: [
    {
      actionId: 'action-1',
      actionName,
      result
    }
  ],
  status: 'executed'
})

const createFeature = (
  execute: AiConversationFeature['execute']
): AiConversationFeature => ({
  cancel: vi.fn(() => true),
  execute: vi.fn(execute)
})

describe('Asyra Design AI conversation controller', () => {
  it('retains ordered safe progress with the settled turn and brackets history correlation', async () => {
    const history = {
      beginTurn: vi.fn(),
      endTurn: vi.fn()
    }
    const feature = createFeature(async (request) => {
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
      return executed({
        appliedElementIds: ['secret-canonical-id'],
        skipped: [],
        status: 'complete'
      })
    })
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-progress',
      feature,
      getElementType: vi.fn(),
      history
    })

    await expect(controller.submit('draw')).resolves.toMatchObject({
      progress: [
        {
          phase: 'context',
          summary: 'Understanding the request'
        },
        {
          phase: 'execution',
          summary: 'Applying changes'
        }
      ],
      turnId: 'conversation-progress:turn:1'
    })
    expect(history.beginTurn).toHaveBeenCalledWith(
      'conversation-progress:turn:1'
    )
    expect(history.endTurn).toHaveBeenCalledWith('conversation-progress:turn:1')
  })

  it('owns stable instance-local conversation and ordered turn records', async () => {
    const feature = createFeature(async () =>
      executed({
        appliedElementIds: ['face-1', 'eye-left-1', 'eye-right-1'],
        compositionId: 'group-1',
        roleToElementIds: {
          face: ['face-1'],
          'left-eye': ['eye-left-1'],
          'right-eye': ['eye-right-1']
        },
        skipped: [],
        status: 'complete'
      })
    )
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-a',
      feature,
      getElementType: vi.fn(() => 'oval')
    })

    await expect(controller.submit('  畫一個貓臉  ')).resolves.toMatchObject({
      conversationId: 'conversation-a',
      intent: '畫一個貓臉',
      outcome: 'success',
      turnId: 'conversation-a:turn:1'
    })
    await expect(controller.submit('把眼睛放大一點')).resolves.toMatchObject({
      conversationId: 'conversation-a',
      turnId: 'conversation-a:turn:2'
    })

    expect(controller.getSnapshot()).toMatchObject({
      activeTurn: null,
      conversationId: 'conversation-a',
      disposed: false,
      settledTurns: [
        {
          turnId: 'conversation-a:turn:1'
        },
        {
          turnId: 'conversation-a:turn:2'
        }
      ]
    })
    expect(Object.isFrozen(controller.getSnapshot())).toBe(true)
    expect(Object.isFrozen(controller.getSnapshot().settledTurns)).toBe(true)
  })

  it('carries immutable detached image attachments through the active turn, Feature metadata, and settlement', async () => {
    const pending = createDeferred<Record<string, unknown>>()
    const feature = createFeature(() => pending.promise)
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-attachment',
      feature,
      getElementType: vi.fn()
    })
    const sourceAttachment = {
      dataUrl: 'data:image/png;base64,dGFiYnk=',
      mediaType: 'image/png' as const,
      name: 'tabby.png',
      size: 5
    }
    const settlement = controller.submit({
      attachments: [sourceAttachment],
      intent: '  請依照這張圖繪製  '
    })

    const active = controller.getSnapshot().activeTurn
    expect(active).toMatchObject({
      attachments: [
        {
          mediaType: 'image/png',
          name: 'tabby.png',
          size: 5
        }
      ],
      intent: '請依照這張圖繪製'
    })
    expect(Object.isFrozen(active?.attachments)).toBe(true)
    expect(Object.isFrozen(active?.attachments[0])).toBe(true)
    expect(feature.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: '請依照這張圖繪製',
        metadata: expect.objectContaining({
          imageAttachments: [
            {
              dataUrl: 'data:image/png;base64,dGFiYnk=',
              mediaType: 'image/png',
              name: 'tabby.png',
              size: 5
            }
          ]
        })
      })
    )

    sourceAttachment.name = 'changed-after-submit.png'
    pending.resolve(
      executed({
        appliedElementIds: [],
        skipped: [],
        status: 'no-change'
      })
    )
    await expect(settlement).resolves.toMatchObject({
      attachments: [
        {
          name: 'tabby.png'
        }
      ],
      intent: '請依照這張圖繪製'
    })
  })

  it('rejects missing text and invalid detached image descriptors before Feature execution', async () => {
    const feature = createFeature(async () => ({
      status: 'failed'
    }))
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-invalid-attachment',
      feature,
      getElementType: vi.fn()
    })

    await expect(
      controller.submit({
        attachments: [
          {
            dataUrl: 'data:image/png;base64,dGFiYnk=',
            mediaType: 'image/png',
            name: 'tabby.png',
            size: 5
          }
        ],
        intent: '   '
      })
    ).rejects.toMatchObject({
      code: 'AI_CONVERSATION_INVALID_INTENT'
    })
    await expect(
      controller.submit({
        attachments: [
          {
            dataUrl: 'data:text/plain;base64,bm90LWltYWdl',
            mediaType: 'text/plain',
            name: 'notes.txt',
            size: 9
          }
        ],
        intent: 'draw this'
      })
    ).rejects.toMatchObject({
      code: 'AI_CONVERSATION_INVALID_ATTACHMENT'
    })
    expect(feature.execute).not.toHaveBeenCalled()
  })

  it('records monotonic elapsed time from accepted submission through settlement', async () => {
    let now = 2_000
    const feature = createFeature(async () => {
      now = 3_250
      return executed({
        appliedElementIds: ['face-1'],
        skipped: [],
        status: 'complete'
      })
    })
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-duration',
      feature,
      getElementType: vi.fn(),
      now: () => now
    })

    await expect(controller.submit('draw')).resolves.toMatchObject({
      durationMs: 1_250,
      outcome: 'success'
    })
    expect(controller.getSnapshot().settledTurns).toMatchObject([
      {
        durationMs: 1_250,
        turnId: 'conversation-duration:turn:1'
      }
    ])
  })

  it('contains presentation observer failures without changing turn execution', async () => {
    const feature = createFeature(async () =>
      executed({
        appliedElementIds: [],
        skipped: [],
        status: 'no-change'
      })
    )
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-observer',
      feature,
      getElementType: vi.fn()
    })

    expect(() =>
      controller.subscribe(() => {
        throw new Error('presentation failed')
      })
    ).not.toThrow()
    await expect(controller.submit('request')).resolves.toMatchObject({
      outcome: 'no-change'
    })
    expect(feature.execute).toHaveBeenCalledOnce()
  })

  it('rejects whitespace and overlap without creating another task queue', async () => {
    const pending = createDeferred<Record<string, unknown>>()
    const feature = createFeature(() => pending.promise)
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-b',
      feature,
      getElementType: vi.fn()
    })

    await expect(controller.submit('   ')).rejects.toMatchObject({
      code: 'AI_CONVERSATION_INVALID_INTENT'
    })
    const first = controller.submit('畫一個貓臉')
    await expect(controller.submit('第二個回合')).rejects.toEqual(
      expect.objectContaining<Partial<AiConversationError>>({
        code: 'AI_CONVERSATION_TURN_ACTIVE'
      })
    )
    expect(feature.execute).toHaveBeenCalledOnce()

    pending.resolve({
      code: 'AI_PROVIDER_TRANSPORT_FAILED',
      stage: 'provider',
      status: 'failed'
    })
    await first
  })

  it('revalidates canonical target hints before every follow-up request', async () => {
    const targetTypes = new Map([
      ['group-1', 'group'],
      ['eye-left-1', 'oval'],
      ['eye-right-1', 'oval'],
      ['whisker-gone', 'vector']
    ])
    const getElementType = vi.fn((elementId: string) =>
      targetTypes.get(elementId)
    )
    const feature = createFeature(async (request) => {
      if (request.intent === '畫一個貓臉') {
        return executed({
          appliedElementIds: [
            'face-1',
            'eye-left-1',
            'eye-right-1',
            'whisker-gone'
          ],
          compositionId: 'group-1',
          roleToElementIds: {
            'left-eye': ['eye-left-1'],
            'right-eye': ['eye-right-1'],
            whiskers: ['whisker-gone']
          },
          skipped: [],
          status: 'complete'
        })
      }
      return executed(
        {
          appliedElementIds: ['eye-left-1', 'eye-right-1'],
          skipped: [],
          status: 'complete'
        },
        'update_composition_elements'
      )
    })
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-c',
      feature,
      getElementType
    })

    await controller.submit('畫一個貓臉')
    targetTypes.delete('whisker-gone')
    await controller.submit('把眼睛放大一點')

    expect(feature.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        intent: '把眼睛放大一點',
        metadata: {
          aiTargets: {
            compositionId: 'group-1',
            roleToElementIds: {
              'left-eye': ['eye-left-1'],
              'right-eye': ['eye-right-1']
            }
          },
          conversationId: 'conversation-c',
          turnId: 'conversation-c:turn:2'
        }
      })
    )
    expect(getElementType).toHaveBeenCalledWith('whisker-gone')
  })

  it('maps partial and no-change execution without inventing a successful mutation', async () => {
    const feature = createFeature(async (request) => {
      if (request.intent === 'partial') {
        return executed({
          appliedElementIds: ['face-1'],
          skipped: [{ reason: 'duplicate-role', role: 'face' }],
          status: 'partial'
        })
      }
      return executed({
        appliedElementIds: [],
        skipped: [{ reason: 'missing-target' }],
        status: 'no-change'
      })
    })
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-d',
      feature,
      getElementType: vi.fn()
    })

    await expect(controller.submit('partial')).resolves.toMatchObject({
      outcome: 'partial'
    })
    await expect(controller.submit('no change')).resolves.toMatchObject({
      outcome: 'no-change'
    })
  })

  it('clears target hints after successful composition deletion', async () => {
    const feature = createFeature(async (request) => {
      if (request.intent === 'create') {
        return executed({
          appliedElementIds: ['face-1'],
          compositionId: 'group-1',
          roleToElementIds: {
            face: ['face-1']
          },
          skipped: [],
          status: 'complete'
        })
      }
      return executed(
        {
          appliedElementIds: ['group-1', 'face-1'],
          skipped: [],
          status: 'complete'
        },
        'remove_ai_composition'
      )
    })
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-e',
      feature,
      getElementType: vi.fn((elementId) =>
        elementId === 'group-1' ? 'group' : 'oval'
      )
    })

    await controller.submit('create')
    await controller.submit('delete')

    expect(controller.getSnapshot().targetHints).toEqual({
      compositionId: null,
      roleToElementIds: {}
    })
  })

  it('routes cancellation through Feature System and contains late settlement after disposal', async () => {
    const pending = createDeferred<Record<string, unknown>>()
    const feature = createFeature(() => pending.promise)
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-f',
      feature,
      getElementType: vi.fn()
    })
    const settlement = controller.submit('畫一個貓臉')

    expect(controller.cancel('user-cancelled')).toBe(true)
    expect(feature.cancel).toHaveBeenCalledWith('user-cancelled')
    const disposal = controller.dispose()
    pending.resolve(
      executed({
        appliedElementIds: ['late-shape'],
        compositionId: 'late-group',
        roleToElementIds: {
          face: ['late-shape']
        },
        status: 'complete'
      })
    )

    await expect(settlement).resolves.toMatchObject({
      outcome: 'cancelled'
    })
    await disposal
    expect(controller.getSnapshot()).toMatchObject({
      activeTurn: null,
      disposed: true,
      settledTurns: []
    })
    expect(controller.getSnapshot().targetHints).toEqual({
      compositionId: null,
      roleToElementIds: {}
    })
  })

  it('correlates confirmation lifecycle to the active turn without owning its decision', async () => {
    const pending = createDeferred<Record<string, unknown>>()
    const feature = createFeature(() => pending.promise)
    const confirmation = {
      beginTurn: vi.fn(),
      cancel: vi.fn(() => true),
      endTurn: vi.fn()
    }
    const controller = createAiConversationController({
      confirmation,
      createConversationId: () => 'conversation-confirmation',
      feature,
      getElementType: vi.fn()
    })
    const settlement = controller.submit('delete')

    expect(confirmation.beginTurn).toHaveBeenCalledWith(
      'conversation-confirmation:turn:1'
    )
    expect(controller.cancel('panel-closed')).toBe(true)
    expect(confirmation.cancel).toHaveBeenCalledWith('panel-closed')
    pending.resolve({
      reason: 'aborted',
      status: 'cancelled'
    })

    await settlement
    expect(confirmation.endTurn).toHaveBeenCalledWith(
      'conversation-confirmation:turn:1'
    )
  })

  it.each([
    [{ reason: 'aborted', status: 'cancelled' }, 'cancelled'],
    [
      {
        code: 'AI_PROVIDER_TRANSPORT_FAILED',
        stage: 'provider',
        status: 'failed'
      },
      'failed'
    ]
  ] as const)('maps terminal result %j to %s', async (result, outcome) => {
    const controller = createAiConversationController({
      createConversationId: () => 'conversation-g',
      feature: createFeature(async () => result),
      getElementType: vi.fn()
    })

    await expect(controller.submit('request')).resolves.toMatchObject({
      outcome
    })
  })
})
