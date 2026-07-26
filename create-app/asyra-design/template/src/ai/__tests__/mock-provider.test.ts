import type { AiProviderInput } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { AsyraDesignAiActionNames } from '../actions'
import {
  ASYRA_DESIGN_MOCK_AI_DELAY_MS,
  AsyraDesignMockAiPhrases,
  createAsyraDesignMockAiProvider,
  type AsyraDesignMockAiDelay
} from '../mock-provider'

const providerInput = (
  intent: string,
  context: unknown = {}
): AiProviderInput => ({
  actions: [],
  attempt: 1,
  context,
  intent
})

const noDelay: AsyraDesignMockAiDelay = vi.fn(async () => undefined)

const generate = async (
  intent: string,
  context: unknown = {},
  delay: AsyraDesignMockAiDelay = noDelay
) => {
  const provider = createAsyraDesignMockAiProvider({ delay })
  return provider.generateActionPlan(providerInput(intent, context), {
    signal: new AbortController().signal
  })
}

describe('Asyra Design deterministic mock AI provider', () => {
  it('returns one schema-shaped editable cat-face batch without internal ids or private reasoning', async () => {
    const plan = await generate(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH)

    expect(plan).toMatchObject({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items: expect.any(Array),
            parent: 'workspace'
          },
          id: 'mock-create-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation: 'Create a simplified cat face from editable Asyra elements',
      planId: 'mock-plan-create-cat-face'
    })
    expect(Reflect.ownKeys(plan as object)).toEqual([
      'actions',
      'explanation',
      'planId'
    ])

    const action = (plan as { actions: { arguments: unknown }[] }).actions[0]
    const descriptor = action.arguments as {
      items: {
        bounds: { height: number; width: number; x: number; y: number }
        primitive: string
        role: string
      }[]
    }
    expect(descriptor.items.length).toBeGreaterThanOrEqual(12)
    expect(descriptor.items.length).toBeLessThanOrEqual(24)
    const fixtureBounds = {
      maxX: Math.max(
        ...descriptor.items.map((item) => item.bounds.x + item.bounds.width)
      ),
      minX: Math.min(...descriptor.items.map((item) => item.bounds.x))
    }
    expect(fixtureBounds).toEqual({
      maxX: 578,
      minX: 142
    })
    expect(
      descriptor.items.every(
        (item) =>
          (item.primitive === 'oval' || item.primitive === 'vector') &&
          item.bounds.x >= 0 &&
          item.bounds.y >= 0 &&
          item.bounds.x + item.bounds.width <= 2048 &&
          item.bounds.y + item.bounds.height <= 2048 &&
          !('id' in item)
      )
    ).toBe(true)
    expect(descriptor.items.map((item) => item.role)).toEqual(
      expect.arrayContaining([
        'face',
        'left-ear',
        'right-ear',
        'left-eye',
        'right-eye',
        'nose',
        'left-whisker-1',
        'right-whisker-1'
      ])
    )
    expect(JSON.stringify(plan)).not.toMatch(
      /chain-of-thought|private reasoning|api[_-]?key|authorization/i
    )
  })

  it('returns one deterministic 24-item detailed cat face within the existing action boundary', async () => {
    const chinese = await generate(
      AsyraDesignMockAiPhrases.CREATE_DETAILED_CAT_FACE_ZH
    )
    const english = await generate(
      AsyraDesignMockAiPhrases.CREATE_DETAILED_CAT_FACE_EN
    )

    expect(chinese).toEqual(english)
    expect(chinese).toMatchObject({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items: expect.any(Array),
            parent: 'workspace'
          },
          id: 'mock-create-detailed-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create a detailed cat face from layered editable Asyra elements',
      planId: 'mock-plan-create-detailed-cat-face'
    })

    const action = (
      chinese as {
        actions: {
          arguments: {
            items: {
              primitive: 'oval' | 'vector'
              role: string
            }[]
          }
        }[]
      }
    ).actions[0]
    const items = action.arguments.items
    expect(items).toHaveLength(24)
    expect(new Set(items.map(({ role }) => role)).size).toBe(24)
    expect(items.filter(({ primitive }) => primitive === 'oval')).toHaveLength(
      11
    )
    expect(
      items.filter(({ primitive }) => primitive === 'vector')
    ).toHaveLength(13)
    expect(items.map(({ role }) => role)).toEqual(
      expect.arrayContaining([
        'left-inner-ear',
        'right-inner-ear',
        'left-iris',
        'right-iris',
        'left-eye-highlight',
        'right-eye-highlight',
        'left-muzzle',
        'right-muzzle'
      ])
    )
    expect(JSON.stringify(chinese)).not.toMatch(
      /chain-of-thought|private reasoning|api[_-]?key|authorization/i
    )
  })

  it('maps bounded English and Traditional Chinese phrases deterministically', async () => {
    const provider = createAsyraDesignMockAiProvider({ delay: noDelay })
    const options = { signal: new AbortController().signal }

    const chinese = await provider.generateActionPlan(
      providerInput(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH),
      options
    )
    const english = await provider.generateActionPlan(
      providerInput(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_EN),
      options
    )
    const repeated = await provider.generateActionPlan(
      providerInput(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH),
      options
    )

    expect(chinese).toEqual(english)
    expect(repeated).toEqual(chinese)
    expect(repeated).not.toBe(chinese)
  })

  it('uses only context-exposed existing eye ids for the eye update fixture', async () => {
    const plan = await generate(AsyraDesignMockAiPhrases.ENLARGE_EYES_ZH, {
      aiTargets: {
        compositionId: 'group-cat',
        roleToElementIds: {
          'left-eye': ['eye-left'],
          'right-eye': ['eye-right']
        }
      }
    })

    expect(plan).toEqual({
      actions: [
        {
          arguments: {
            updates: [
              {
                elementId: 'eye-left',
                geometry: {
                  scaleX: 1.2,
                  scaleY: 1.2
                }
              },
              {
                elementId: 'eye-right',
                geometry: {
                  scaleX: 1.2,
                  scaleY: 1.2
                }
              }
            ]
          },
          id: 'mock-enlarge-eyes',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Enlarge the existing cat-face eye elements',
      planId: 'mock-plan-enlarge-eyes'
    })
    expect(JSON.stringify(plan)).not.toContain(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
    )
  })

  it('uses only context-exposed existing whisker ids for the color update fixture', async () => {
    const plan = await generate(AsyraDesignMockAiPhrases.RECOLOR_WHISKERS_ZH, {
      aiTargets: {
        compositionId: 'group-cat',
        roleToElementIds: {
          whiskers: ['whisker-1', 'whisker-2', 'whisker-3']
        }
      }
    })

    expect(plan).toEqual({
      actions: [
        {
          arguments: {
            updates: [
              {
                elementId: 'whisker-1',
                style: {
                  strokeColor: '#2563EB'
                }
              },
              {
                elementId: 'whisker-2',
                style: {
                  strokeColor: '#2563EB'
                }
              },
              {
                elementId: 'whisker-3',
                style: {
                  strokeColor: '#2563EB'
                }
              }
            ]
          },
          id: 'mock-recolor-whiskers',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Recolor the existing cat-face whisker elements blue',
      planId: 'mock-plan-recolor-whiskers'
    })
  })

  it('targets the current composition for confirmation-required removal', async () => {
    const plan = await generate(AsyraDesignMockAiPhrases.DELETE_CAT_FACE_ZH, {
      aiTargets: {
        compositionId: 'group-cat',
        roleToElementIds: {}
      }
    })

    expect(plan).toEqual({
      actions: [
        {
          arguments: {
            compositionId: 'group-cat'
          },
          id: 'mock-remove-cat-face',
          name: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION
        }
      ],
      explanation: 'Remove the existing cat-face composition',
      planId: 'mock-plan-remove-cat-face'
    })
  })

  it('returns a deterministic duplicate-role partial fixture for app semantic preflight', async () => {
    const plan = await generate(AsyraDesignMockAiPhrases.PARTIAL_RESULT_ZH)
    const items = (
      plan as {
        actions: { arguments: { items: { role: string }[] } }[]
      }
    ).actions[0].arguments.items
    const roles = items.map((item) => item.role)

    expect(plan).toMatchObject({
      actions: [
        {
          id: 'mock-create-partial-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      planId: 'mock-plan-partial-cat-face'
    })
    expect(roles.filter((role) => role === 'right-whisker-2')).toHaveLength(2)
  })

  it('rejects unsupported or missing follow-up targets without inventing an action or fallback composition', async () => {
    await expect(
      generate(AsyraDesignMockAiPhrases.ENLARGE_EYES_ZH)
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_INVALID_INPUT'
    })
    await expect(generate('幫我畫一艘太空船')).rejects.toMatchObject({
      code: 'AI_PROVIDER_INVALID_INPUT'
    })
  })

  it('exposes one stable provider-failure fixture after the configured delay', async () => {
    await expect(
      generate(AsyraDesignMockAiPhrases.PROVIDER_FAILURE_ZH)
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_PROVIDER_TRANSPORT_FAILED',
        message: 'Mock AI provider failed.',
        retryable: false
      })
    )
  })

  it('uses the finite product delay and releases caller-aborted work', async () => {
    let observedDelay = -1
    let observedSignal: AbortSignal | undefined
    const delayStarted = Promise.withResolvers<undefined>()
    const delay: AsyraDesignMockAiDelay = vi.fn(
      (delayMs, signal) =>
        new Promise<void>((resolve, reject) => {
          observedDelay = delayMs
          observedSignal = signal
          delayStarted.resolve(undefined)
          signal.addEventListener(
            'abort',
            () => reject(new Error('delay aborted')),
            { once: true }
          )
        })
    )
    const controller = new AbortController()
    const provider = createAsyraDesignMockAiProvider({ delay })

    const settlement = provider.generateActionPlan(
      providerInput(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH),
      { signal: controller.signal }
    )
    await delayStarted.promise
    controller.abort('cancelled')

    await expect(settlement).rejects.toMatchObject({
      code: 'AI_PROVIDER_ABORTED'
    })
    expect(observedDelay).toBe(ASYRA_DESIGN_MOCK_AI_DELAY_MS)
    expect(observedSignal?.aborted).toBe(true)
  })

  it('clears the product timer when the caller aborts', async () => {
    vi.useFakeTimers()
    try {
      const controller = new AbortController()
      const provider = createAsyraDesignMockAiProvider()
      const settlement = provider.generateActionPlan(
        providerInput(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH),
        { signal: controller.signal }
      )

      expect(vi.getTimerCount()).toBe(1)
      controller.abort('cancelled')

      await expect(settlement).rejects.toMatchObject({
        code: 'AI_PROVIDER_ABORTED'
      })
      expect(vi.getTimerCount()).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('disposes only its own pending work and keeps provider instances isolated', async () => {
    const firstStarted = Promise.withResolvers<undefined>()
    const secondStarted = Promise.withResolvers<undefined>()
    const delayFor = (started: PromiseWithResolvers<undefined>) =>
      vi.fn(
        (_delayMs: number, signal: AbortSignal) =>
          new Promise<void>((resolve, reject) => {
            started.resolve(undefined)
            signal.addEventListener(
              'abort',
              () => reject(new Error('disposed delay')),
              { once: true }
            )
          })
      )
    const first = createAsyraDesignMockAiProvider({
      delay: delayFor(firstStarted)
    })
    const second = createAsyraDesignMockAiProvider({
      delay: delayFor(secondStarted)
    })
    const signal = new AbortController().signal
    const firstSettlement = first.generateActionPlan(
      providerInput(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH),
      { signal }
    )
    const secondSettlement = second.generateActionPlan(
      providerInput(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH),
      { signal }
    )
    await Promise.all([firstStarted.promise, secondStarted.promise])

    await first.dispose()

    await expect(firstSettlement).rejects.toMatchObject({
      code: 'AI_PROVIDER_DISPOSED'
    })
    expect(secondSettlement).toEqual(expect.any(Promise))

    void secondSettlement.catch(() => undefined)
    await second.dispose()
  })

  it('uses no network transport for any deterministic fixture', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    await generate(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH)
    await generate(AsyraDesignMockAiPhrases.ENLARGE_EYES_EN, {
      aiTargets: {
        compositionId: 'group-cat',
        roleToElementIds: {
          'left-eye': ['eye-left'],
          'right-eye': ['eye-right']
        }
      }
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
