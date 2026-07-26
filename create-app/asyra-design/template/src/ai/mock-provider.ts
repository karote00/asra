import {
  AiProviderError,
  type AiProvider,
  type AiProviderInput
} from '@asyra/ai-agent-runtime'
import { AsyraDesignAiActionNames } from './actions'

export const ASYRA_DESIGN_MOCK_AI_DELAY_MS = 650
export const ASYRA_DESIGN_MOCK_AI_MAX_DELAY_MS = 10_000

export const AsyraDesignMockAiPhrases = Object.freeze({
  CREATE_CAT_FACE_EN: 'draw a cat face',
  CREATE_CAT_FACE_ZH: '畫一個貓臉',
  CREATE_DETAILED_CAT_FACE_EN: 'draw a detailed cat face',
  CREATE_DETAILED_CAT_FACE_ZH: '畫一個精緻的貓臉',
  DELETE_CAT_FACE_EN: 'delete the current cat face',
  DELETE_CAT_FACE_ZH: '刪除目前的貓臉',
  ENLARGE_EYES_EN: 'make the eyes bigger',
  ENLARGE_EYES_ZH: '把眼睛放大一點',
  PARTIAL_RESULT_EN: 'simulate a partial result',
  PARTIAL_RESULT_ZH: '模擬部分成功',
  PROVIDER_FAILURE_EN: 'simulate a provider failure',
  PROVIDER_FAILURE_ZH: '模擬 provider 失敗',
  RECOLOR_WHISKERS_EN: 'make the whiskers blue',
  RECOLOR_WHISKERS_ZH: '把鬍鬚改成藍色'
} as const)

export type AsyraDesignMockAiDelay = (
  delayMs: number,
  signal: AbortSignal
) => Promise<void>

export interface CreateAsyraDesignMockAiProviderOptions {
  readonly delay?: AsyraDesignMockAiDelay
  readonly delayMs?: number
}

export interface AsyraDesignMockAiProvider extends AiProvider {
  dispose(): Promise<void>
}

interface MockBounds {
  readonly height: number
  readonly width: number
  readonly x: number
  readonly y: number
}

interface MockPoint {
  readonly x: number
  readonly y: number
}

interface MockStyle {
  readonly fillColor?: string
  readonly strokeColor?: string
  readonly strokeWidth?: number
}

interface MockCompositionItem {
  readonly bounds: MockBounds
  readonly closed?: boolean
  readonly points?: readonly MockPoint[]
  readonly primitive: 'oval' | 'vector'
  readonly role: string
  readonly style: MockStyle
}

type MockFixture =
  | 'create-cat-face'
  | 'create-detailed-cat-face'
  | 'delete-cat-face'
  | 'enlarge-eyes'
  | 'partial-result'
  | 'provider-failure'
  | 'recolor-whiskers'

const defaultDelay: AsyraDesignMockAiDelay = (delayMs, signal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }

    const timer = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, delayMs)
    const abort = () => {
      globalThis.clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  Reflect.ownKeys(value).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor && 'value' in descriptor) {
      deepFreeze(descriptor.value)
    }
  })
  return Object.freeze(value)
}

const oval = (
  role: string,
  bounds: MockBounds,
  style: MockStyle
): MockCompositionItem => ({
  bounds,
  primitive: 'oval',
  role,
  style
})

const vector = (
  role: string,
  points: readonly MockPoint[],
  bounds: MockBounds,
  style: MockStyle,
  closed = false
): MockCompositionItem => ({
  bounds,
  closed,
  points,
  primitive: 'vector',
  role,
  style
})

const createCatFaceItemsAtSource = (): MockCompositionItem[] => [
  oval(
    'face',
    { height: 280, width: 320, x: 520, y: 220 },
    {
      fillColor: '#F3C892',
      strokeColor: '#5B3A29',
      strokeWidth: 4
    }
  ),
  vector(
    'left-ear',
    [
      { x: 552, y: 252 },
      { x: 576, y: 158 },
      { x: 646, y: 236 }
    ],
    { height: 94, width: 94, x: 552, y: 158 },
    {
      fillColor: '#F3C892',
      strokeColor: '#5B3A29',
      strokeWidth: 4
    },
    true
  ),
  vector(
    'right-ear',
    [
      { x: 714, y: 236 },
      { x: 784, y: 158 },
      { x: 808, y: 252 }
    ],
    { height: 94, width: 94, x: 714, y: 158 },
    {
      fillColor: '#F3C892',
      strokeColor: '#5B3A29',
      strokeWidth: 4
    },
    true
  ),
  oval(
    'left-eye',
    { height: 70, width: 58, x: 594, y: 300 },
    {
      fillColor: '#FFFDF7',
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  oval(
    'right-eye',
    { height: 70, width: 58, x: 708, y: 300 },
    {
      fillColor: '#FFFDF7',
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  oval(
    'left-pupil',
    { height: 34, width: 22, x: 612, y: 320 },
    {
      fillColor: '#29211D'
    }
  ),
  oval(
    'right-pupil',
    { height: 34, width: 22, x: 726, y: 320 },
    {
      fillColor: '#29211D'
    }
  ),
  vector(
    'nose',
    [
      { x: 660, y: 382 },
      { x: 700, y: 382 },
      { x: 680, y: 402 }
    ],
    { height: 20, width: 40, x: 660, y: 382 },
    {
      fillColor: '#D66B78',
      strokeColor: '#5B3A29',
      strokeWidth: 2
    },
    true
  ),
  vector(
    'left-mouth',
    [
      { x: 680, y: 402 },
      { x: 660, y: 426 },
      { x: 642, y: 420 }
    ],
    { height: 24, width: 38, x: 642, y: 402 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  vector(
    'right-mouth',
    [
      { x: 680, y: 402 },
      { x: 700, y: 426 },
      { x: 718, y: 420 }
    ],
    { height: 24, width: 38, x: 680, y: 402 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  vector(
    'left-whisker-1',
    [
      { x: 630, y: 394 },
      { x: 472, y: 372 }
    ],
    { height: 22, width: 158, x: 472, y: 372 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  vector(
    'left-whisker-2',
    [
      { x: 630, y: 410 },
      { x: 462, y: 410 }
    ],
    { height: 1, width: 168, x: 462, y: 410 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  vector(
    'left-whisker-3',
    [
      { x: 630, y: 426 },
      { x: 472, y: 448 }
    ],
    { height: 22, width: 158, x: 472, y: 426 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  vector(
    'right-whisker-1',
    [
      { x: 730, y: 394 },
      { x: 888, y: 372 }
    ],
    { height: 22, width: 158, x: 730, y: 372 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  vector(
    'right-whisker-2',
    [
      { x: 730, y: 410 },
      { x: 898, y: 410 }
    ],
    { height: 1, width: 168, x: 730, y: 410 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  ),
  vector(
    'right-whisker-3',
    [
      { x: 730, y: 426 },
      { x: 888, y: 448 }
    ],
    { height: 22, width: 158, x: 730, y: 426 },
    {
      strokeColor: '#5B3A29',
      strokeWidth: 3
    }
  )
]

const CAT_FACE_VISIBLE_X_OFFSET = -320

const createDetailedCatFaceItemsAtSource = (): MockCompositionItem[] => [
  oval(
    'face',
    { height: 290, width: 320, x: 520, y: 220 },
    {
      fillColor: '#D9A86C',
      strokeColor: '#4A2B20',
      strokeWidth: 5
    }
  ),
  vector(
    'left-ear',
    [
      { x: 552, y: 252 },
      { x: 576, y: 158 },
      { x: 646, y: 236 }
    ],
    { height: 94, width: 94, x: 552, y: 158 },
    {
      fillColor: '#D9A86C',
      strokeColor: '#4A2B20',
      strokeWidth: 5
    },
    true
  ),
  vector(
    'right-ear',
    [
      { x: 714, y: 236 },
      { x: 784, y: 158 },
      { x: 808, y: 252 }
    ],
    { height: 94, width: 94, x: 714, y: 158 },
    {
      fillColor: '#D9A86C',
      strokeColor: '#4A2B20',
      strokeWidth: 5
    },
    true
  ),
  vector(
    'left-inner-ear',
    [
      { x: 574, y: 229 },
      { x: 582, y: 184 },
      { x: 616, y: 222 }
    ],
    { height: 45, width: 42, x: 574, y: 184 },
    {
      fillColor: '#E98A8F',
      strokeColor: '#7A403D',
      strokeWidth: 2
    },
    true
  ),
  vector(
    'right-inner-ear',
    [
      { x: 744, y: 222 },
      { x: 778, y: 184 },
      { x: 786, y: 229 }
    ],
    { height: 45, width: 42, x: 744, y: 184 },
    {
      fillColor: '#E98A8F',
      strokeColor: '#7A403D',
      strokeWidth: 2
    },
    true
  ),
  oval(
    'left-eye',
    { height: 82, width: 64, x: 592, y: 292 },
    {
      fillColor: '#FFFDF8',
      strokeColor: '#4A2B20',
      strokeWidth: 3
    }
  ),
  oval(
    'right-eye',
    { height: 82, width: 64, x: 704, y: 292 },
    {
      fillColor: '#FFFDF8',
      strokeColor: '#4A2B20',
      strokeWidth: 3
    }
  ),
  oval(
    'left-iris',
    { height: 50, width: 30, x: 609, y: 310 },
    {
      fillColor: '#67A58B',
      strokeColor: '#31594B',
      strokeWidth: 2
    }
  ),
  oval(
    'right-iris',
    { height: 50, width: 30, x: 721, y: 310 },
    {
      fillColor: '#67A58B',
      strokeColor: '#31594B',
      strokeWidth: 2
    }
  ),
  oval(
    'left-pupil',
    { height: 36, width: 12, x: 618, y: 318 },
    {
      fillColor: '#201915'
    }
  ),
  oval(
    'right-pupil',
    { height: 36, width: 12, x: 730, y: 318 },
    {
      fillColor: '#201915'
    }
  ),
  oval(
    'left-eye-highlight',
    { height: 12, width: 8, x: 619, y: 320 },
    {
      fillColor: '#FFFFFF'
    }
  ),
  oval(
    'right-eye-highlight',
    { height: 12, width: 8, x: 731, y: 320 },
    {
      fillColor: '#FFFFFF'
    }
  ),
  oval(
    'left-muzzle',
    { height: 58, width: 80, x: 606, y: 380 },
    {
      fillColor: '#FFF0D4'
    }
  ),
  oval(
    'right-muzzle',
    { height: 58, width: 80, x: 674, y: 380 },
    {
      fillColor: '#FFF0D4'
    }
  ),
  vector(
    'nose',
    [
      { x: 660, y: 390 },
      { x: 700, y: 390 },
      { x: 680, y: 410 }
    ],
    { height: 20, width: 40, x: 660, y: 390 },
    {
      fillColor: '#C75E6A',
      strokeColor: '#4A2B20',
      strokeWidth: 2
    },
    true
  ),
  vector(
    'left-mouth',
    [
      { x: 680, y: 410 },
      { x: 665, y: 431 },
      { x: 647, y: 426 }
    ],
    { height: 21, width: 33, x: 647, y: 410 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 3
    }
  ),
  vector(
    'right-mouth',
    [
      { x: 680, y: 410 },
      { x: 695, y: 431 },
      { x: 713, y: 426 }
    ],
    { height: 21, width: 33, x: 680, y: 410 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 3
    }
  ),
  vector(
    'left-whisker-1',
    [
      { x: 630, y: 396 },
      { x: 472, y: 372 }
    ],
    { height: 24, width: 158, x: 472, y: 372 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 2
    }
  ),
  vector(
    'left-whisker-2',
    [
      { x: 630, y: 412 },
      { x: 462, y: 412 }
    ],
    { height: 1, width: 168, x: 462, y: 412 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 2
    }
  ),
  vector(
    'left-whisker-3',
    [
      { x: 630, y: 428 },
      { x: 472, y: 452 }
    ],
    { height: 24, width: 158, x: 472, y: 428 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 2
    }
  ),
  vector(
    'right-whisker-1',
    [
      { x: 730, y: 396 },
      { x: 888, y: 372 }
    ],
    { height: 24, width: 158, x: 730, y: 372 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 2
    }
  ),
  vector(
    'right-whisker-2',
    [
      { x: 730, y: 412 },
      { x: 898, y: 412 }
    ],
    { height: 1, width: 168, x: 730, y: 412 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 2
    }
  ),
  vector(
    'right-whisker-3',
    [
      { x: 730, y: 428 },
      { x: 888, y: 452 }
    ],
    { height: 24, width: 158, x: 730, y: 428 },
    {
      strokeColor: '#4A2B20',
      strokeWidth: 2
    }
  )
]

const offsetCatFaceItems = (
  items: readonly MockCompositionItem[]
): MockCompositionItem[] =>
  items.map((item) => ({
    ...item,
    bounds: {
      ...item.bounds,
      x: item.bounds.x + CAT_FACE_VISIBLE_X_OFFSET
    },
    ...(item.points
      ? {
          points: item.points.map((point) => ({
            ...point,
            x: point.x + CAT_FACE_VISIBLE_X_OFFSET
          }))
        }
      : {})
  }))

const createCatFaceItems = (): MockCompositionItem[] =>
  offsetCatFaceItems(createCatFaceItemsAtSource())

const createDetailedCatFaceItems = (): MockCompositionItem[] =>
  offsetCatFaceItems(createDetailedCatFaceItemsAtSource())

const phraseToFixture = (intent: string): MockFixture | null => {
  const normalized = intent.trim().toLocaleLowerCase('en-US')
  const phrases = AsyraDesignMockAiPhrases
  const fixtures: readonly [readonly string[], MockFixture][] = [
    [
      [
        phrases.CREATE_DETAILED_CAT_FACE_ZH,
        phrases.CREATE_DETAILED_CAT_FACE_EN
      ],
      'create-detailed-cat-face'
    ],
    [
      [phrases.CREATE_CAT_FACE_ZH, phrases.CREATE_CAT_FACE_EN],
      'create-cat-face'
    ],
    [[phrases.ENLARGE_EYES_ZH, phrases.ENLARGE_EYES_EN], 'enlarge-eyes'],
    [
      [phrases.RECOLOR_WHISKERS_ZH, phrases.RECOLOR_WHISKERS_EN],
      'recolor-whiskers'
    ],
    [
      [phrases.DELETE_CAT_FACE_ZH, phrases.DELETE_CAT_FACE_EN],
      'delete-cat-face'
    ],
    [[phrases.PARTIAL_RESULT_ZH, phrases.PARTIAL_RESULT_EN], 'partial-result'],
    [
      [phrases.PROVIDER_FAILURE_ZH, phrases.PROVIDER_FAILURE_EN],
      'provider-failure'
    ]
  ]
  return (
    fixtures.find(([candidates]) =>
      candidates.some(
        (candidate) => candidate.toLocaleLowerCase('en-US') === normalized
      )
    )?.[1] ?? null
  )
}

const readAiTargets = (
  input: AiProviderInput
): {
  readonly compositionId: string | null
  readonly roleToElementIds: Readonly<Record<string, readonly string[]>>
} => {
  const source =
    isPlainObject(input.metadata) && isPlainObject(input.metadata.aiTargets)
      ? input.metadata
      : input.context
  if (!isPlainObject(source) || !isPlainObject(source.aiTargets)) {
    return {
      compositionId: null,
      roleToElementIds: {}
    }
  }

  const compositionId =
    typeof source.aiTargets.compositionId === 'string' &&
    source.aiTargets.compositionId.length > 0
      ? source.aiTargets.compositionId
      : null
  const roleToElementIds: Record<string, readonly string[]> = {}
  if (isPlainObject(source.aiTargets.roleToElementIds)) {
    for (const [role, value] of Object.entries(
      source.aiTargets.roleToElementIds
    )) {
      if (!Array.isArray(value)) {
        continue
      }
      const ids = [
        ...new Set(
          value.filter(
            (elementId): elementId is string =>
              typeof elementId === 'string' && elementId.length > 0
          )
        )
      ]
      if (ids.length > 0) {
        roleToElementIds[role] = Object.freeze(ids)
      }
    }
  }

  return {
    compositionId,
    roleToElementIds: Object.freeze(roleToElementIds)
  }
}

const invalidInput = (): never => {
  throw new AiProviderError({
    code: 'AI_PROVIDER_INVALID_INPUT',
    message: 'Mock AI request is unsupported or missing current targets.'
  })
}

const planForFixture = (fixture: MockFixture, input: AiProviderInput) => {
  const targets = readAiTargets(input)
  if (fixture === 'provider-failure') {
    throw new AiProviderError({
      code: 'AI_PROVIDER_TRANSPORT_FAILED',
      message: 'Mock AI provider failed.'
    })
  }

  if (fixture === 'create-detailed-cat-face') {
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items: createDetailedCatFaceItems(),
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
  }

  if (fixture === 'create-cat-face' || fixture === 'partial-result') {
    const items = createCatFaceItems()
    if (fixture === 'partial-result') {
      items.push(
        vector(
          'right-whisker-2',
          [
            { x: 730, y: 414 },
            { x: 892, y: 430 }
          ],
          { height: 16, width: 162, x: 730, y: 414 },
          {
            strokeColor: '#5B3A29',
            strokeWidth: 3
          }
        )
      )
    }
    const partial = fixture === 'partial-result'
    return deepFreeze({
      actions: [
        {
          arguments: {
            compositionRole: 'cat-face',
            items,
            parent: 'workspace'
          },
          id: partial ? 'mock-create-partial-cat-face' : 'mock-create-cat-face',
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        }
      ],
      explanation: partial
        ? 'Create a cat face while demonstrating one recoverable skipped item'
        : 'Create a simplified cat face from editable Asyra elements',
      planId: partial
        ? 'mock-plan-partial-cat-face'
        : 'mock-plan-create-cat-face'
    })
  }

  if (fixture === 'enlarge-eyes') {
    const left = targets.roleToElementIds['left-eye']
    const right = targets.roleToElementIds['right-eye']
    if (left?.length !== 1 || right?.length !== 1) {
      return invalidInput()
    }
    return deepFreeze({
      actions: [
        {
          arguments: {
            updates: [left[0], right[0]].map((elementId) => ({
              elementId,
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            }))
          },
          id: 'mock-enlarge-eyes',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Enlarge the existing cat-face eye elements',
      planId: 'mock-plan-enlarge-eyes'
    })
  }

  if (fixture === 'recolor-whiskers') {
    const whiskers = targets.roleToElementIds.whiskers
    if (!whiskers || whiskers.length === 0) {
      return invalidInput()
    }
    return deepFreeze({
      actions: [
        {
          arguments: {
            updates: whiskers.map((elementId) => ({
              elementId,
              style: {
                strokeColor: '#2563EB'
              }
            }))
          },
          id: 'mock-recolor-whiskers',
          name: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS
        }
      ],
      explanation: 'Recolor the existing cat-face whisker elements blue',
      planId: 'mock-plan-recolor-whiskers'
    })
  }

  if (!targets.compositionId) {
    return invalidInput()
  }
  return deepFreeze({
    actions: [
      {
        arguments: {
          compositionId: targets.compositionId
        },
        id: 'mock-remove-cat-face',
        name: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION
      }
    ],
    explanation: 'Remove the existing cat-face composition',
    planId: 'mock-plan-remove-cat-face'
  })
}

const abortError = (disposed: boolean): AiProviderError =>
  new AiProviderError({
    code: disposed ? 'AI_PROVIDER_DISPOSED' : 'AI_PROVIDER_ABORTED',
    message: disposed
      ? 'Mock AI provider was disposed.'
      : 'Mock AI provider request was aborted.'
  })

const validateDelayMs = (value: number): number => {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > ASYRA_DESIGN_MOCK_AI_MAX_DELAY_MS
  ) {
    throw new AiProviderError({
      code: 'AI_PROVIDER_INVALID_CONFIGURATION',
      message: 'Mock AI delay configuration is invalid.'
    })
  }
  return value
}

export const createAsyraDesignMockAiProvider = (
  options: CreateAsyraDesignMockAiProviderOptions = {}
): AsyraDesignMockAiProvider => {
  const delay = options.delay ?? defaultDelay
  const delayMs = validateDelayMs(
    options.delayMs ?? ASYRA_DESIGN_MOCK_AI_DELAY_MS
  )
  const active = new Set<AbortController>()
  let disposed = false

  const provider: AsyraDesignMockAiProvider = {
    generateActionPlan: async (input, requestOptions) => {
      if (disposed) {
        throw abortError(true)
      }

      const controller = new AbortController()
      const abort = () => controller.abort(requestOptions.signal.reason)
      if (requestOptions.signal.aborted) {
        abort()
      } else {
        requestOptions.signal.addEventListener('abort', abort, { once: true })
      }
      active.add(controller)

      try {
        await delay(delayMs, controller.signal)
        if (controller.signal.aborted) {
          throw abortError(disposed)
        }
        const fixture = phraseToFixture(input.intent)
        if (!fixture) {
          return invalidInput()
        }
        return planForFixture(fixture, input)
      } catch (error) {
        if (controller.signal.aborted) {
          throw abortError(disposed)
        }
        if (error instanceof AiProviderError) {
          throw error
        }
        throw new AiProviderError({
          code: 'AI_PROVIDER_TRANSPORT_FAILED',
          message: 'Mock AI provider failed.'
        })
      } finally {
        requestOptions.signal.removeEventListener('abort', abort)
        active.delete(controller)
      }
    },
    dispose: async () => {
      if (disposed) {
        return
      }
      disposed = true
      active.forEach((controller) => controller.abort())
      active.clear()
    }
  }

  return Object.freeze(provider)
}
