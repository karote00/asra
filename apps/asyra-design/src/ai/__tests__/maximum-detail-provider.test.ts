import type { AiProviderInput } from '@asyra/ai-agent-runtime'
import { expect, it } from 'vitest'
import { AsyraDesignAiActionNames } from '../../constants'
import { createAsyraDesignAiActions } from '../actions'
import {
  AsyraDesignMockAiPhrases,
  createAsyraDesignMockAiProvider
} from '../mock-provider'

const runMaximumDetail = process.env.ASYRA_DESIGN_RUN_MAXIMUM_DETAIL === '1'

it.runIf(runMaximumDetail)(
  'materializes the maximum-detail VTracer fixture once through the production provider parser',
  async () => {
    const provider = createAsyraDesignMockAiProvider({
      delay: async () => undefined
    })
    const input: AiProviderInput = {
      actions: [],
      attempt: 1,
      context: {},
      intent: AsyraDesignMockAiPhrases.DRAW_REFERENCE_IMAGE_MAXIMUM_ZH,
      metadata: {
        imageAttachments: [
          {
            dataUrl: 'data:image/png;base64,cHJvdmlkZXItZ2F0ZQ==',
            mediaType: 'image/png',
            name: 'maximum-detail-reference.png',
            size: 20
          }
        ]
      }
    }
    const plan = await provider.generateActionPlan(input, {
      signal: new AbortController().signal
    })
    const items = (
      plan as {
        actions: {
          arguments: {
            items: {
              bounds: {
                height: number
                width: number
                x: number
                y: number
              }
              paths?: readonly {
                closed: boolean
                points: readonly unknown[]
              }[]
              role: string
            }[]
          }
        }[]
      }
    ).actions[0].arguments.items
    expect(plan).toMatchObject({
      actions: [
        {
          id: 'mock-create-maximum-detail-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation:
        'Create a maximum-detail tabby portrait from editable Asyra vector layers',
      planId: 'mock-plan-create-maximum-detail-cat-face'
    })
    const pointCount = items.reduce(
      (total, item) =>
        total +
        (item.paths ?? []).reduce(
          (pathTotal, path) => pathTotal + path.points.length,
          0
        ),
      0
    )
    const validItemCount = items.filter(
      (item) =>
        (item.paths?.length ?? 0) > 0 &&
        Object.values(item.bounds).every(Number.isFinite) &&
        item.paths?.every((path) => path.points.length >= (path.closed ? 3 : 2))
    ).length
    expect(items).toHaveLength(27_471)
    expect(pointCount).toBe(295_794)
    expect(validItemCount).toBe(items.length)
    expect(new Set(items.map(({ role }) => role)).size).toBe(items.length)
    const insertAction = createAsyraDesignAiActions({} as never).find(
      ({ name }) => name === AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
    )
    expect(insertAction).toBeDefined()
    expect(insertAction?.schema.parse(plan.actions[0].arguments)).toMatchObject(
      {
        success: true
      }
    )
  },
  300_000
)
