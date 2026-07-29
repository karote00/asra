import type { AiProviderInput } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { AsyraDesignAiActionNames } from '../actions'
import {
  ASYRA_DESIGN_MOCK_AI_DELAY_MS,
  AsyraDesignMockAiPhrases,
  createAsyraDesignMockAiProvider,
  type AsyraDesignMockAiDelay
} from '../mock-provider'
import type { AsyraDesignVTracer } from '../vtracer'
import { createDeferred, type Deferred } from './deferred'

const providerInput = (
  intent: string,
  context: unknown = {},
  metadata?: AiProviderInput['metadata']
): AiProviderInput => ({
  actions: [],
  attempt: 1,
  context,
  intent,
  ...(metadata === undefined ? {} : { metadata })
})

const noDelay: AsyraDesignMockAiDelay = vi.fn(async () => undefined)
const referenceData = 'data:image/png;base64,c2VjcmV0LXJlZmVyZW5jZQ=='
const sizedReferenceData =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABogAAAOtCAIAAAA='
const referenceMetadata = Object.freeze({
  imageAttachments: Object.freeze([
    Object.freeze({
      dataUrl: referenceData,
      mediaType: 'image/png',
      name: 'tabby.png',
      size: 16
    })
  ])
})
const sizedReferenceMetadata = Object.freeze({
  imageAttachments: Object.freeze([
    Object.freeze({
      dataUrl: sizedReferenceData,
      mediaType: 'image/png',
      name: 'tabby.png',
      size: 29
    })
  ])
})

const generate = async (
  intent: string,
  context: unknown = {},
  delay: AsyraDesignMockAiDelay = noDelay,
  metadata?: AiProviderInput['metadata']
) => {
  const provider = createAsyraDesignMockAiProvider({ delay })
  return provider.generateActionPlan(providerInput(intent, context, metadata), {
    signal: new AbortController().signal
  })
}

interface CrdtFixtureItem {
  readonly paths?: readonly {
    readonly points: readonly unknown[]
  }[]
  readonly primitive: 'oval' | 'vector'
  readonly role: string
  readonly style: {
    readonly fillColor?: string
  }
}

const getCrdtFixtureItems = (
  plan: Awaited<ReturnType<typeof generate>>
): readonly CrdtFixtureItem[] =>
  (
    plan.actions[0]?.arguments as
      | {
          readonly items?: readonly CrdtFixtureItem[]
        }
      | undefined
  )?.items ?? []

const getCrdtFixturePointCount = (items: readonly CrdtFixtureItem[]): number =>
  items.reduce(
    (total, item) =>
      total +
      (item.paths?.reduce(
        (pathTotal, path) => pathTotal + path.points.length,
        0
      ) ?? 0),
    0
  )

describe('Asyra Design deterministic mock AI provider', () => {
  it('separates provider delay from deterministic plan materialization', async () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previous = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)

    try {
      await generate(AsyraDesignMockAiPhrases.CREATE_FAST_CRDT_FIXTURE_EN)
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previous
    }

    expect(phaseNames).toEqual(
      expect.arrayContaining([
        'ai-provider:delay',
        'ai-provider:materialize-plan'
      ])
    )
  })

  it('returns the committed 16-item fast CRDT composition through the ordinary insert action', async () => {
    const plan = await generate(
      AsyraDesignMockAiPhrases.CREATE_FAST_CRDT_FIXTURE_EN
    )

    expect(plan).toMatchObject({
      actions: [
        {
          arguments: {
            compositionRole: 'performance-fixture',
            items: expect.any(Array),
            parent: 'workspace'
          },
          id: 'mock-create-fast-crdt-fixture',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      planId: 'mock-plan-create-fast-crdt-fixture'
    })
    const items = getCrdtFixtureItems(plan)
    expect(items).toHaveLength(16)
    expect(items.every(({ primitive }) => primitive === 'vector')).toBe(true)
    expect(items[0]).toMatchObject({
      role: 'portrait-background',
      style: { fillColor: '#FFFFFF' }
    })
    expect(getCrdtFixturePointCount(items)).toBe(12_919)
  })

  it('returns a deterministic 320-item CRDT composition through the ordinary insert action', async () => {
    const plan = await generate('create the 320-item CRDT performance fixture')

    expect(plan).toMatchObject({
      actions: [
        {
          arguments: {
            compositionRole: 'performance-fixture-320',
            items: expect.any(Array),
            parent: 'workspace'
          },
          id: 'mock-create-320-crdt-fixture',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      planId: 'mock-plan-create-320-crdt-fixture'
    })

    const items = getCrdtFixtureItems(plan)
    const fastItems = getCrdtFixtureItems(
      await generate(AsyraDesignMockAiPhrases.CREATE_FAST_CRDT_FIXTURE_EN)
    )

    expect(items).toHaveLength(320)
    expect(items.slice(0, fastItems.length)).toEqual(fastItems)
    expect(new Set(items.map(({ role }) => role)).size).toBe(320)
    expect(items.every(({ primitive }) => primitive === 'vector')).toBe(true)
    expect(getCrdtFixturePointCount(items)).toBe(51_768)
  })

  it('returns a deterministic 1,280-item CRDT composition through the ordinary insert action', async () => {
    const plan = await generate(
      AsyraDesignMockAiPhrases.CREATE_1280_ITEM_CRDT_FIXTURE_EN
    )

    expect(plan).toMatchObject({
      actions: [
        {
          arguments: {
            compositionRole: 'performance-fixture-1280',
            items: expect.any(Array),
            parent: 'workspace'
          },
          id: 'mock-create-1280-crdt-fixture',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      planId: 'mock-plan-create-1280-crdt-fixture'
    })

    const items = getCrdtFixtureItems(plan)
    const mediumItems = getCrdtFixtureItems(
      await generate(AsyraDesignMockAiPhrases.CREATE_320_ITEM_CRDT_FIXTURE_EN)
    )

    expect(items).toHaveLength(1280)
    expect(items.slice(0, mediumItems.length)).toEqual(mediumItems)
    expect(new Set(items.map(({ role }) => role)).size).toBe(1280)
    expect(items.every(({ primitive }) => primitive === 'vector')).toBe(true)
    expect(getCrdtFixturePointCount(items)).toBe(86_474)
  })

  it('routes ordinary and detailed cat-face phrases to the same precise fixture', async () => {
    const ordinaryChinese = await generate(
      AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH
    )
    const ordinaryEnglish = await generate(
      AsyraDesignMockAiPhrases.CREATE_CAT_FACE_EN
    )
    const detailedChinese = await generate(
      AsyraDesignMockAiPhrases.CREATE_DETAILED_CAT_FACE_ZH
    )

    expect(ordinaryChinese).toEqual(detailedChinese)
    expect(ordinaryEnglish).toEqual(detailedChinese)
    expect(detailedChinese).toMatchObject({
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
        'Create a high-detail tabby cat portrait from editable Asyra vector layers',
      planId: 'mock-plan-create-detailed-cat-face'
    })
    expect(JSON.stringify(detailedChinese)).not.toMatch(
      /chain-of-thought|private reasoning|api[_-]?key|authorization/i
    )
  })

  it('returns an App-wording-free clarification candidate for the generic attached-image phrase', async () => {
    const clarificationPlan = await generate(
      AsyraDesignMockAiPhrases.DRAW_REFERENCE_IMAGE_ZH,
      {},
      noDelay,
      referenceMetadata
    )

    expect(clarificationPlan).toEqual({
      actions: [
        {
          arguments: {},
          id: 'mock-request-drawing-detail-choice',
          name: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE
        }
      ],
      explanation: 'Choose a drawing detail level before creating elements',
      planId: 'mock-plan-request-drawing-detail-choice'
    })
    expect(JSON.stringify(clarificationPlan)).not.toContain(referenceData)
    await expect(
      generate(AsyraDesignMockAiPhrases.DRAW_REFERENCE_IMAGE_ZH)
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_INVALID_INPUT'
    })
  })

  it('uses the registered VTracer tool once for an explicit arbitrary whole-image vectorization intent', async () => {
    const vectorize = vi.fn(async () => ({
      height: 32,
      items: [
        {
          bounds: { height: 32, width: 64, x: 0, y: 0 },
          paths: [
            {
              closed: true,
              points: [
                { x: 0, y: 0 },
                { x: 64, y: 0 },
                { x: 64, y: 32 },
                { x: 0, y: 32 }
              ]
            }
          ],
          primitive: 'vector' as const,
          role: 'reference-vector-000001',
          style: { fillColor: '#FFFFFF' }
        },
        {
          bounds: { height: 16, width: 16, x: 8, y: 8 },
          paths: [
            {
              closed: true,
              points: [
                { x: 8, y: 8 },
                { x: 24, y: 8 },
                { x: 24, y: 24 },
                { x: 8, y: 24 }
              ]
            }
          ],
          primitive: 'vector' as const,
          role: 'reference-vector-000002',
          style: { fillColor: '#2563EB' }
        }
      ],
      pointCount: 8,
      width: 64
    }))
    const vectorizer = { vectorize } satisfies AsyraDesignVTracer
    const provider = createAsyraDesignMockAiProvider({
      delay: noDelay,
      vectorizer
    })
    const signal = new AbortController().signal

    const plan = await provider.generateActionPlan(
      providerInput(
        AsyraDesignMockAiPhrases.VECTORIZE_IMAGE_EN,
        {},
        referenceMetadata
      ),
      { signal }
    )

    expect(vectorize).toHaveBeenCalledOnce()
    expect(vectorize).toHaveBeenCalledWith({
      attachment: referenceMetadata.imageAttachments[0],
      profile: 'photo-faithful',
      signal: expect.any(AbortSignal)
    })
    expect(plan).toMatchObject({
      actions: [
        {
          arguments: {
            compositionRole: 'vectorized-image',
            items: expect.arrayContaining([
              expect.objectContaining({ role: 'reference-vector-000001' }),
              expect.objectContaining({ role: 'reference-vector-000002' })
            ]),
            parent: 'workspace'
          },
          id: 'mock-vectorize-reference-image',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Vectorize the complete attached image into ordinary editable Asyra vector elements',
      planId: 'mock-plan-vectorize-reference-image'
    })
    expect(JSON.stringify(plan)).not.toContain(referenceData)
  })

  it('does not invoke VTracer when the attachment contract or required image-preparation capability is unavailable', async () => {
    const vectorizer = {
      vectorize: vi.fn()
    } satisfies AsyraDesignVTracer
    const provider = createAsyraDesignMockAiProvider({
      delay: noDelay,
      vectorizer
    })
    const options = { signal: new AbortController().signal }

    await expect(
      provider.generateActionPlan(
        providerInput(AsyraDesignMockAiPhrases.VECTORIZE_IMAGE_EN),
        options
      )
    ).rejects.toMatchObject({ code: 'AI_PROVIDER_INVALID_INPUT' })
    await expect(
      provider.generateActionPlan(
        providerInput(
          'Remove the background, reimage the subject, and vectorize it',
          {},
          referenceMetadata
        ),
        options
      )
    ).rejects.toMatchObject({ code: 'AI_PROVIDER_INVALID_INPUT' })
    expect(vectorizer.vectorize).not.toHaveBeenCalled()
  })

  it('routes the exact cat-only instruction to a same-size pure-white fixture only with an accepted attachment', async () => {
    const plan = await generate(
      AsyraDesignMockAiPhrases.DRAW_ONLY_CAT_ON_SAME_SIZE_WHITE_BACKGROUND_EN,
      {},
      noDelay,
      sizedReferenceMetadata
    )
    const items = (
      plan as {
        actions: {
          arguments: {
            items: {
              bounds: { height: number; width: number; x: number; y: number }
              role: string
              style: { fillColor?: string }
            }[]
          }
        }[]
      }
    ).actions[0].arguments.items
    const background = items.find(({ role }) => role === 'portrait-background')

    expect(plan).toMatchObject({
      actions: [
        {
          id: 'mock-create-cat-only-white-background',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      planId: 'mock-plan-create-cat-only-white-background'
    })
    expect(background).toMatchObject({
      bounds: { height: 941, width: 1672, x: 0, y: 0 },
      style: { fillColor: '#FFFFFF' }
    })
    expect(items).toHaveLength(7075)
    expect(items.filter(({ role }) => role === 'left-pupil')).toHaveLength(1)
    expect(items.filter(({ role }) => role === 'right-pupil')).toHaveLength(1)
    expect(items.map(({ role }) => role)).toEqual(
      expect.arrayContaining(['left-pupil', 'right-pupil'])
    )
    await expect(
      generate(
        AsyraDesignMockAiPhrases.DRAW_ONLY_CAT_ON_SAME_SIZE_WHITE_BACKGROUND_EN
      )
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_INVALID_INPUT'
    })
  })

  it('routes the exact balanced choice with the retained attachment to the balanced fixture', async () => {
    const balancedPlan = await generate(
      AsyraDesignMockAiPhrases.DRAW_REFERENCE_IMAGE_BALANCED_ZH,
      {},
      noDelay,
      referenceMetadata
    )
    const textOnlyPlan = await generate(
      AsyraDesignMockAiPhrases.CREATE_DETAILED_CAT_FACE_ZH
    )

    expect(balancedPlan).toEqual(textOnlyPlan)
    await expect(
      generate(AsyraDesignMockAiPhrases.DRAW_REFERENCE_IMAGE_BALANCED_ZH)
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_INVALID_INPUT'
    })
  })

  it('returns one deterministic 7111-layer VTracer tabby portrait', async () => {
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
        'Create a high-detail tabby cat portrait from editable Asyra vector layers',
      planId: 'mock-plan-create-detailed-cat-face'
    })

    const action = (
      chinese as {
        actions: {
          arguments: {
            items: {
              bounds: {
                height: number
                width: number
                x: number
                y: number
              }
              paths?: {
                closed: boolean
                points: { x: number; y: number }[]
              }[]
              points?: { x: number; y: number }[]
              primitive: 'oval' | 'vector'
              role: string
              style: {
                fillColor?: string
                strokeColor?: string
              }
            }[]
          }
        }[]
      }
    ).actions[0]
    const items = action.arguments.items
    const paths = items.flatMap((item) => {
      if (item.paths) {
        return item.paths
      }
      return item.points ? [{ closed: false, points: item.points }] : []
    })
    const pointCount = paths.reduce(
      (total, path) => total + path.points.length,
      0
    )
    const palette = new Set(
      items.flatMap(({ style }) =>
        [style.fillColor, style.strokeColor].filter(
          (color): color is string => color !== undefined
        )
      )
    )

    expect(items).toHaveLength(7111)
    expect(new Set(items.map(({ role }) => role)).size).toBe(7111)
    expect(items.filter(({ primitive }) => primitive === 'vector').length).toBe(
      7111
    )
    expect(paths.length).toBeGreaterThanOrEqual(7111)
    expect(pointCount).toBeGreaterThanOrEqual(115_000)
    expect(palette.size).toBeGreaterThanOrEqual(90)
    expect(
      items.every(
        ({ bounds }) =>
          bounds.x >= 0 &&
          bounds.y >= 0 &&
          bounds.x + bounds.width <= 2048 &&
          bounds.y + bounds.height <= 2048
      )
    ).toBe(true)
    expect(items.map(({ role }) => role)).toEqual(
      expect.arrayContaining([
        'portrait-background',
        'tabby-vector-0001',
        'left-eye',
        'right-eye',
        'left-eye-detail-0001',
        'right-eye-detail-0001',
        'left-whisker-000',
        'right-whisker-000'
      ])
    )
    expect(items.map(({ role }) => role)).not.toEqual(
      expect.arrayContaining([
        'face-base',
        'center-forehead-stripe',
        'face-fur-0000'
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

  it('uses only context-exposed existing pupil ids for the red fill update fixture', async () => {
    const plan = await generate(AsyraDesignMockAiPhrases.RECOLOR_PUPILS_EN, {
      aiTargets: {
        compositionId: 'group-cat',
        roleToElementIds: {
          pupils: ['pupil-left', 'pupil-right']
        }
      }
    })

    expect(plan).toEqual({
      actions: [
        {
          arguments: {
            updates: [
              {
                elementId: 'pupil-left',
                style: {
                  fillColor: '#DC2626'
                }
              },
              {
                elementId: 'pupil-right',
                style: {
                  fillColor: '#DC2626'
                }
              }
            ]
          },
          id: 'mock-recolor-pupils',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Recolor the existing cat-face pupil elements red',
      planId: 'mock-plan-recolor-pupils'
    })
    await expect(
      generate(AsyraDesignMockAiPhrases.RECOLOR_PUPILS_EN)
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_INVALID_INPUT'
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
      explanation:
        'Create a high-detail cat face while demonstrating one recoverable skipped item',
      planId: 'mock-plan-partial-cat-face'
    })
    expect(items).toHaveLength(7112)
    expect(new Set(roles).size).toBe(7111)
    expect(roles.filter((role) => role === 'right-whisker-000')).toHaveLength(2)
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
    const delayStarted = createDeferred<undefined>()
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
    const firstStarted = createDeferred<undefined>()
    const secondStarted = createDeferred<undefined>()
    const delayFor = (started: Deferred<undefined>) =>
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
