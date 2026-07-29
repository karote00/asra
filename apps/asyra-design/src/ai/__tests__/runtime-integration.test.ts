import {
  createAiAgentRuntime,
  createGenericHttpAiProvider,
  type AiProvider
} from '@asyra/ai-agent-runtime'
import { getFeature } from '@asyra/feature-system'
import { MouseButton, SystemMode } from '@asyra/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  elementApis,
  fillApis,
  hierarchyApis,
  selectionApis,
  systemContextApis,
  transactionApis
} from '../../common-apis'
import {
  AsyraDesignAiActionNames,
  type AsyraDesignAiDeliveryMode
} from '../actions'
import { createAsyraDesignAiRuntimeInput } from '../composition'
import { createAsyraDesignAiConversationController } from '../conversation'
import { createAsyraDesignAiConfirmationBroker } from '../confirmation'
import {
  AsyraDesignMockAiPhrases,
  createAsyraDesignMockAiProvider
} from '../mock-provider'
import { createAsyraDesignAiStartup } from '../mode'
import {
  registerAiAgentFeature,
  type AiAgentFeatureApi
} from '../../features/ai-agent'
import { FeatureNames } from '../../constants'
import { createDeferred } from './deferred'
import { asyraDesignDocumentInteractionLock } from '../document-interaction-lock'

const plan = () => ({
  planId: 'reference-plan',
  explanation: 'Update the current selection.',
  actions: [
    {
      id: 'visibility-1',
      name: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      arguments: {
        elementId: 'shape-1',
        visible: false
      }
    },
    {
      id: 'selection-1',
      name: AsyraDesignAiActionNames.SELECT_ELEMENTS,
      arguments: {
        elementIds: ['shape-1', 'shape-2']
      }
    }
  ]
})

const createCanonicalElementIds = (
  orderedElementIds: readonly string[]
): readonly string[] => Object.freeze([...orderedElementIds])

const prepareCommonApis = () => {
  vi.spyOn(selectionApis, 'getSelectedIds').mockReturnValue(['shape-1'])
  vi.spyOn(selectionApis, 'selectElements').mockImplementation(() => undefined)
  vi.spyOn(hierarchyApis, 'getWorkspaceId').mockReturnValue('workspace-1')
  vi.spyOn(hierarchyApis, 'getFlattenedElementIds').mockReturnValue([
    'shape-1',
    'shape-2'
  ])
  vi.spyOn(systemContextApis, 'getSystemContextSnapshot').mockReturnValue({
    activeElementId: null,
    hoveredElementId: null,
    keyAlt: false,
    keyCtrl: false,
    keyMeta: false,
    keyShift: false,
    mouseButton: MouseButton.NONE,
    mouseDelta: {
      x: 0,
      y: 0
    },
    mouseDown: false,
    mouseDragging: false,
    mouseDragStart: undefined,
    mousePosition: {
      x: 0,
      y: 0
    },
    primaryTool: 'selection',
    selectedElementIds: ['shape-1'],
    systemFeatureFlags: {},
    systemMode: SystemMode.DESIGN,
    systemPermissions: {}
  })
  vi.spyOn(systemContextApis, 'setAiDrawingProgress').mockImplementation(
    () => undefined
  )
  vi.spyOn(elementApis, 'getElementType').mockReturnValue('rectangle')
  vi.spyOn(elementApis, 'isElementVisible').mockReturnValue(true)
  vi.spyOn(elementApis, 'isElementLocked').mockReturnValue(false)
  vi.spyOn(elementApis, 'getElementBounds').mockReturnValue({
    x: 10,
    y: 20,
    width: 100,
    height: 80
  })
  vi.spyOn(elementApis, 'setElementVisible').mockReturnValue(true)
  vi.spyOn(transactionApis, 'runTransaction').mockImplementation((execute) =>
    execute()
  )
}

const executeReferencePlan = async (
  provider: AiProvider,
  deliveryMode: AsyraDesignAiDeliveryMode = 'atomic'
) => {
  const runtime = createAiAgentRuntime(
    createAsyraDesignAiRuntimeInput({
      deliveryMode,
      permissionRules: {
        [AsyraDesignAiActionNames.SELECT_ELEMENTS]: 'allow',
        [AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY]: 'allow'
      },
      provider
    })
  )

  try {
    return await runtime.run({
      intent: 'hide shape one and select both shapes',
      signal: new AbortController().signal
    })
  } finally {
    await runtime.dispose()
  }
}

const executeMockComposition = async (
  intent: string,
  createCanonicalId: () => string
) => {
  const provider = createAsyraDesignMockAiProvider({
    delay: async () => undefined
  })
  vi.spyOn(elementApis, 'createElement').mockReturnValue('cat-face-group')
  vi.spyOn(elementApis, 'createElementsInParent').mockImplementation(
    (options) =>
      createCanonicalElementIds(options.map(() => createCanonicalId()))
  )
  vi.spyOn(hierarchyApis, 'groupElements').mockReturnValue({
    bounds: {
      height: 320,
      width: 440,
      x: 460,
      y: 158
    },
    elementIds: [],
    groupId: 'legacy-post-hoc-group'
  })
  const runtime = createAiAgentRuntime(
    createAsyraDesignAiRuntimeInput({
      deliveryMode: 'atomic',
      permissionRules: {
        [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow'
      },
      provider
    })
  )

  try {
    return await runtime.run({
      intent,
      signal: new AbortController().signal
    })
  } finally {
    await runtime.dispose()
    await provider.dispose()
  }
}

describe('Asyra Design AI runtime integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs the bounded reference actions through one common transaction', async () => {
    prepareCommonApis()
    const provider: AiProvider = {
      generateActionPlan: vi.fn(async () => plan())
    }

    await expect(executeReferencePlan(provider)).resolves.toMatchObject({
      status: 'executed',
      planId: 'reference-plan',
      transaction: {
        status: 'committed'
      },
      actionResults: [
        {
          actionName: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY
        },
        {
          actionName: AsyraDesignAiActionNames.SELECT_ELEMENTS
        }
      ]
    })

    expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
    expect(elementApis.setElementVisible).toHaveBeenCalledWith(
      'shape-1',
      false,
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
    expect(selectionApis.selectElements).toHaveBeenCalledWith(
      ['shape-1', 'shape-2'],
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
  })

  it('composes progressive runtime actions through ordinary immediate delivery', async () => {
    prepareCommonApis()
    const provider: AiProvider = {
      generateActionPlan: vi.fn(async () => plan())
    }

    await expect(
      executeReferencePlan(provider, 'progressive')
    ).resolves.toMatchObject({
      status: 'executed',
      transaction: {
        status: 'committed'
      }
    })

    expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
    expect(elementApis.setElementVisible).toHaveBeenCalledWith(
      'shape-1',
      false,
      {
        sharedDelivery: 'immediate',
        undoable: true
      }
    )
    expect(selectionApis.selectElements).toHaveBeenCalledWith(
      ['shape-1', 'shape-2'],
      {
        sharedDelivery: 'immediate',
        undoable: true
      }
    )
  })

  it('allows the mock startup drawing-detail clarification with detached image metadata and no canonical mutation', async () => {
    prepareCommonApis()
    const createElement = vi.spyOn(elementApis, 'createElement')
    const changeElementGeometry = vi.spyOn(elementApis, 'changeElementGeometry')
    const provider = createAsyraDesignMockAiProvider({
      delay: async () => undefined
    })
    const confirmation = createAsyraDesignAiConfirmationBroker()
    const history = {
      correlateCommittedAction: vi.fn(() => false),
      dispose: vi.fn(),
      getCurrentActionId: vi.fn(() => null)
    }
    const startup = createAsyraDesignAiStartup('mock', {
      createConfirmation: () => confirmation,
      createHistory: () => history as never,
      createProvider: () => provider
    })
    const createRuntimeInput = startup.runtimeOptions.createRuntimeInput
    if (!createRuntimeInput) {
      throw new Error('Mock AI startup must provide runtime input.')
    }
    const runtime = createAiAgentRuntime(createRuntimeInput())

    try {
      await expect(
        runtime.run({
          intent: AsyraDesignMockAiPhrases.DRAW_REFERENCE_IMAGE_ZH,
          metadata: {
            imageAttachments: [
              {
                dataUrl: 'data:image/png;base64,aW50ZWdyYXRpb24=',
                mediaType: 'image/png',
                name: 'integration-reference.png',
                size: 11
              }
            ]
          },
          signal: new AbortController().signal
        })
      ).resolves.toMatchObject({
        actionResults: [
          {
            actionName: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
            result: {
              action: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
              clarification: {
                kind: 'drawing-detail',
                optionIds: ['balanced', 'maximum']
              },
              status: 'no-change'
            }
          }
        ],
        status: 'executed'
      })
      expect(createElement).not.toHaveBeenCalled()
      expect(changeElementGeometry).not.toHaveBeenCalled()
      expect(history.correlateCommittedAction).not.toHaveBeenCalled()
    } finally {
      await runtime.dispose()
      await confirmation.dispose()
      await provider.dispose()
    }
  })

  it('replaces the fake provider with generic HTTP without changing app action contracts', async () => {
    prepareCommonApis()
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => plan()
    }))
    const provider = createGenericHttpAiProvider({
      endpoint: '/api/ai-agent',
      fetch
    })

    await expect(executeReferencePlan(provider)).resolves.toMatchObject({
      status: 'executed',
      planId: 'reference-plan'
    })

    expect(fetch).toHaveBeenCalledOnce()
    expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
    expect(elementApis.setElementVisible).toHaveBeenCalledOnce()
    expect(selectionApis.selectElements).toHaveBeenCalledOnce()

    provider.dispose()
  })

  it('commits one mock drawing turn through one outer common transaction', async () => {
    prepareCommonApis()
    let nextElement = 0

    await expect(
      executeMockComposition(
        AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH,
        () => `cat-element-${(nextElement += 1)}`
      )
    ).resolves.toMatchObject({
      actionResults: [
        {
          actionName: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
          result: {
            compositionId: 'cat-face-group',
            skipped: [],
            status: 'complete'
          }
        }
      ],
      status: 'executed',
      transaction: {
        status: 'committed'
      }
    })

    expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
    expect(elementApis.createElementsInParent).toHaveBeenCalledOnce()
    expect(
      vi
        .mocked(elementApis.createElementsInParent)
        .mock.calls.flatMap(([options]) => options)
    ).toHaveLength(7111)
    expect(
      vi.mocked(elementApis.createElementsInParent).mock.results[0].value
    ).toHaveLength(7111)
    expect(elementApis.createElementsInParent).toHaveBeenCalledWith(
      expect.any(Array),
      'cat-face-group',
      {
        sharedDelivery: 'transaction-end',
        undoable: true
      }
    )
    expect(elementApis.createElement).toHaveBeenCalledOnce()
    expect(hierarchyApis.groupElements).not.toHaveBeenCalled()
  })

  it('commits one valid vectorized item inside one Group and one outer transaction', async () => {
    prepareCommonApis()
    vi.spyOn(elementApis, 'createElement').mockReturnValue(
      'vectorized-image-group'
    )
    vi.spyOn(elementApis, 'createElementsInParent').mockReturnValue(
      createCanonicalElementIds(['reference-vector-id'])
    )
    const groupElements = vi.spyOn(hierarchyApis, 'groupElements')
    const provider: AiProvider = {
      generateActionPlan: vi.fn(async () => ({
        actions: [
          {
            arguments: {
              compositionRole: 'vectorized-image',
              items: [
                {
                  bounds: {
                    height: 32,
                    width: 64,
                    x: 0,
                    y: 0
                  },
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
                  primitive: 'vector',
                  role: 'reference-vector-000001',
                  style: {
                    fillColor: '#2563EB'
                  }
                }
              ],
              parent: 'workspace'
            },
            id: 'vectorize-one-item',
            name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
          }
        ],
        planId: 'vectorize-one-item-plan'
      }))
    }
    const runtime = createAiAgentRuntime(
      createAsyraDesignAiRuntimeInput({
        deliveryMode: 'atomic',
        permissionRules: {
          [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow'
        },
        provider
      })
    )

    try {
      await expect(
        runtime.run({
          intent: 'Vectorize this image',
          signal: new AbortController().signal
        })
      ).resolves.toMatchObject({
        actionResults: [
          {
            result: {
              appliedElementIds: ['reference-vector-id'],
              compositionId: 'vectorized-image-group',
              status: 'complete'
            }
          }
        ],
        status: 'executed',
        transaction: {
          status: 'committed'
        }
      })
      expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
      expect(elementApis.createElement).toHaveBeenCalledOnce()
      expect(elementApis.createElementsInParent).toHaveBeenCalledOnce()
      expect(groupElements).not.toHaveBeenCalled()
    } finally {
      await runtime.dispose()
    }
  })

  it('makes a progressive composition batch visible before later plan actions inside the same outer transaction', async () => {
    prepareCommonApis()
    const transactionEvents: string[] = []
    vi.mocked(transactionApis.runTransaction).mockImplementation(
      async (execute) => {
        expect(asyraDesignDocumentInteractionLock.isActive()).toBe(true)
        transactionEvents.push('transaction:start')
        const result = await execute()
        expect(asyraDesignDocumentInteractionLock.isActive()).toBe(true)
        transactionEvents.push('transaction:commit')
        return result
      }
    )
    vi.mocked(systemContextApis.setAiDrawingProgress).mockImplementation(
      (state) => {
        expect(asyraDesignDocumentInteractionLock.isActive()).toBe(true)
        transactionEvents.push(
          state
            ? `progress:${state.phase}:${state.completedElements}`
            : 'progress:clear'
        )
      }
    )
    vi.mocked(elementApis.setElementVisible).mockImplementation(() => {
      expect(asyraDesignDocumentInteractionLock.isActive()).toBe(true)
      transactionEvents.push('action:visibility')
      return true
    })
    vi.spyOn(elementApis, 'createElement').mockReturnValue('progressive-group')
    let progressiveBatchNumber = 0
    vi.spyOn(elementApis, 'createElementsInParent').mockImplementation(
      (options) => {
        expect(asyraDesignDocumentInteractionLock.isActive()).toBe(true)
        progressiveBatchNumber += 1
        return createCanonicalElementIds(
          options.map(
            (_, index) =>
              `progressive-vector-id-${progressiveBatchNumber}-${index}`
          )
        )
      }
    )
    const provider: AiProvider = {
      generateActionPlan: vi.fn(async () => ({
        actions: [
          {
            arguments: {
              compositionRole: 'vectorized-image',
              items: Array.from({ length: 40 }, (_, index) => ({
                bounds: {
                  height: 32,
                  width: 64,
                  x: 0,
                  y: 0
                },
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
                primitive: 'vector',
                role: `reference-vector-${String(index + 1).padStart(6, '0')}`,
                style: {
                  fillColor: '#2563EB'
                }
              })),
              parent: 'workspace'
            },
            id: 'progressive-vectorize',
            name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
          },
          {
            arguments: {
              elementId: 'shape-1',
              visible: false
            },
            id: 'follow-up-visibility',
            name: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY
          }
        ],
        planId: 'progressive-follow-up-plan'
      }))
    }
    const runtime = createAiAgentRuntime(
      createAsyraDesignAiRuntimeInput({
        permissionRules: {
          [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow',
          [AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY]: 'allow'
        },
        provider
      })
    )

    try {
      expect(asyraDesignDocumentInteractionLock.isActive()).toBe(false)
      await expect(
        runtime.run({
          intent: 'Vectorize the reference, then hide shape one',
          signal: new AbortController().signal
        })
      ).resolves.toMatchObject({
        actionResults: [
          {
            actionName: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
          },
          {
            actionName: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY
          }
        ],
        status: 'executed',
        transaction: {
          status: 'committed'
        }
      })

      expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
      expect(elementApis.createElement).toHaveBeenCalledOnce()
      expect(elementApis.createElement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'group'
        }),
        {
          sharedDelivery: 'immediate',
          undoable: true
        }
      )
      expect(elementApis.createElementsInParent).toHaveBeenCalledTimes(2)
      expect(elementApis.createElementsInParent).toHaveBeenNthCalledWith(
        1,
        expect.any(Array),
        'progressive-group',
        {
          sharedDelivery: 'immediate',
          undoable: true
        }
      )
      expect(
        vi
          .mocked(elementApis.createElementsInParent)
          .mock.calls.map(([options]) => options.length)
      ).toEqual([32, 8])
      expect(elementApis.setElementVisible).toHaveBeenCalledOnce()
      expect(
        vi.mocked(elementApis.createElementsInParent).mock
          .invocationCallOrder[0]
      ).toBeLessThan(
        vi.mocked(elementApis.setElementVisible).mock.invocationCallOrder[0]
      )
      expect(transactionEvents).toEqual([
        'transaction:start',
        'progress:preparing:0',
        'progress:drawing:32',
        'progress:drawing:40',
        'progress:clear',
        'action:visibility',
        'transaction:commit'
      ])
      expect(asyraDesignDocumentInteractionLock.isActive()).toBe(false)
    } finally {
      await runtime.dispose()
    }
  })

  it('stops progressive delivery when the Feature-owned signal is cancelled', async () => {
    prepareCommonApis()
    const densePoints = Array.from({ length: 2048 }, (_, index) => ({
      x: index % 32,
      y: Math.floor(index / 32)
    }))
    const featureControl: {
      cancel?: AiAgentFeatureApi['cancel']
    } = {}
    let featureCancelResult = false
    const progressStates: string[] = []
    vi.mocked(systemContextApis.setAiDrawingProgress).mockImplementation(
      (state) => {
        expect(asyraDesignDocumentInteractionLock.isActive()).toBe(true)
        progressStates.push(
          state ? `${state.phase}:${state.completedElements}` : 'clear'
        )
        if (state?.phase === 'drawing' && !featureCancelResult) {
          featureCancelResult =
            featureControl.cancel?.('cancel-progressive-delivery') ?? false
        }
      }
    )
    vi.spyOn(elementApis, 'createElement').mockReturnValue(
      'feature-abort-progressive-group'
    )
    vi.spyOn(elementApis, 'createElementsInParent').mockImplementation(
      (options) =>
        createCanonicalElementIds(
          options.map((_, index) => `feature-abort-vector-${index + 1}`)
        )
    )
    const provider: AiProvider = {
      generateActionPlan: vi.fn(async () => ({
        actions: [
          {
            arguments: {
              compositionRole: 'feature-abort-composition',
              items: [
                {
                  bounds: {
                    height: 64,
                    width: 32,
                    x: 0,
                    y: 0
                  },
                  paths: [
                    {
                      closed: false,
                      points: densePoints
                    }
                  ],
                  primitive: 'vector',
                  role: 'feature-abort-dense-vector',
                  style: {
                    fillColor: '#2563EB'
                  }
                },
                {
                  bounds: {
                    height: 2,
                    width: 2,
                    x: 80,
                    y: 0
                  },
                  paths: [
                    {
                      closed: false,
                      points: [
                        { x: 80, y: 0 },
                        { x: 82, y: 2 }
                      ]
                    }
                  ],
                  primitive: 'vector',
                  role: 'feature-abort-tail-vector',
                  style: {
                    fillColor: '#2563EB'
                  }
                }
              ],
              parent: 'workspace'
            },
            id: 'feature-abort-progressive-composition',
            name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
          }
        ],
        planId: 'feature-abort-progressive-plan'
      }))
    }
    const runtime = createAiAgentRuntime(
      createAsyraDesignAiRuntimeInput({
        deliveryMode: 'progressive',
        permissionRules: {
          [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow'
        },
        provider
      })
    )
    let observedFeatureSignal: AbortSignal | undefined
    const registration = registerAiAgentFeature({
      providerEnabled: true,
      runtime: {
        run: (request) => {
          observedFeatureSignal = request.signal
          return runtime.run(request)
        }
      }
    })
    const feature = getFeature(FeatureNames.AI_AGENT) as AiAgentFeatureApi
    featureControl.cancel = feature.cancel

    try {
      await expect(
        feature.execute('create a progressive composition')
      ).resolves.toMatchObject({
        reason: 'aborted',
        status: 'cancelled'
      })

      expect(featureCancelResult).toBe(true)
      expect(observedFeatureSignal).toBeInstanceOf(AbortSignal)
      expect(observedFeatureSignal?.aborted).toBe(true)
      expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
      expect(elementApis.createElementsInParent).toHaveBeenCalledOnce()
      expect(elementApis.createElementsInParent).toHaveBeenCalledWith(
        [expect.any(Object)],
        'feature-abort-progressive-group',
        {
          sharedDelivery: 'immediate',
          undoable: true
        }
      )
      expect(progressStates).toEqual(['preparing:0', 'drawing:1', 'clear'])
      expect(asyraDesignDocumentInteractionLock.isActive()).toBe(false)
    } finally {
      registration.dispose()
      await runtime.dispose()
    }
  })

  it('commits recoverable per-object failure as a partial mock result', async () => {
    prepareCommonApis()
    let nextElement = 0

    await expect(
      executeMockComposition(
        AsyraDesignMockAiPhrases.PARTIAL_RESULT_ZH,
        () => `partial-element-${(nextElement += 1)}`
      )
    ).resolves.toMatchObject({
      actionResults: [
        {
          result: {
            skipped: [
              {
                reason: 'duplicate-role',
                role: 'right-whisker-000'
              }
            ],
            status: 'partial'
          }
        }
      ],
      status: 'executed',
      transaction: {
        status: 'committed'
      }
    })

    expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
    expect(elementApis.createElement).toHaveBeenCalledOnce()
    expect(elementApis.createElementsInParent).toHaveBeenCalledOnce()
    expect(
      vi
        .mocked(elementApis.createElementsInParent)
        .mock.calls.flatMap(([options]) => options)
    ).toHaveLength(7111)
    expect(
      vi.mocked(elementApis.createElementsInParent).mock.results[0].value
    ).toHaveLength(7111)
  })

  it('returns a fatal execution failure so the outer transaction can roll back', async () => {
    prepareCommonApis()
    const mutationFailure = new Error('canonical mutation failed')
    let nextElement = 0

    await expect(
      executeMockComposition(
        AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH,
        () => {
          nextElement += 1
          if (nextElement === 2) {
            throw mutationFailure
          }
          return `fatal-element-${nextElement}`
        }
      )
    ).resolves.toMatchObject({
      code: 'AI_EXECUTION_FAILED',
      stage: 'execution',
      status: 'failed'
    })

    expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
    expect(hierarchyApis.groupElements).not.toHaveBeenCalled()
  })

  it('uses revalidated canonical ids for a Feature-owned follow-up instead of regenerating', async () => {
    prepareCommonApis()
    const provider = createAsyraDesignMockAiProvider({
      delay: async () => undefined
    })
    let nextElement = 0
    vi.spyOn(elementApis, 'createElement').mockReturnValue('cat-face-group')
    vi.spyOn(elementApis, 'createElementsInParent').mockImplementation(
      (options) =>
        createCanonicalElementIds(
          options.map(() => `cat-element-${(nextElement += 1)}`)
        )
    )
    const scaleVectorElementAroundCenter = vi
      .spyOn(elementApis, 'scaleVectorElementAroundCenter')
      .mockReturnValue(true)
    vi.spyOn(fillApis, 'getPrimaryFillColor').mockReturnValue('#130C06')
    const updatePrimaryFillColor = vi.spyOn(fillApis, 'updatePrimaryFillColor')
    const updatePrimaryFillColors = vi
      .spyOn(fillApis, 'updatePrimaryFillColors')
      .mockImplementation((updates) => updates.map(() => true))
    vi.mocked(elementApis.getElementType).mockImplementation((elementId) => {
      if (elementId === 'cat-face-group') {
        return 'group'
      }
      return elementId.startsWith('cat-element-') ? 'vector' : undefined
    })
    const runtime = createAiAgentRuntime(
      createAsyraDesignAiRuntimeInput({
        deliveryMode: 'atomic',
        permissionRules: {
          [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow',
          [AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS]: 'allow'
        },
        provider
      })
    )
    const registration = registerAiAgentFeature({
      providerEnabled: true,
      runtime
    })
    const feature = getFeature(FeatureNames.AI_AGENT) as AiAgentFeatureApi
    const conversation = createAsyraDesignAiConversationController({
      createConversationId: () => 'runtime-conversation',
      feature,
      getElementType: (elementId) => elementApis.getElementType(elementId)
    })

    try {
      await expect(
        conversation.submit(AsyraDesignMockAiPhrases.CREATE_CAT_FACE_ZH)
      ).resolves.toMatchObject({
        outcome: 'success'
      })
      await expect(
        conversation.submit(AsyraDesignMockAiPhrases.ENLARGE_EYES_ZH)
      ).resolves.toMatchObject({
        outcome: 'success'
      })
      await expect(
        conversation.submit(AsyraDesignMockAiPhrases.RECOLOR_PUPILS_EN)
      ).resolves.toMatchObject({
        outcome: 'success'
      })

      expect(elementApis.createElement).toHaveBeenCalledOnce()
      expect(elementApis.createElementsInParent).toHaveBeenCalledOnce()
      expect(
        vi
          .mocked(elementApis.createElementsInParent)
          .mock.calls.flatMap(([options]) => options)
      ).toHaveLength(7111)
      expect(
        vi.mocked(elementApis.createElementsInParent).mock.results[0].value
      ).toHaveLength(7111)
      expect(scaleVectorElementAroundCenter).toHaveBeenCalled()
      expect(
        scaleVectorElementAroundCenter.mock.calls.length
      ).toBeGreaterThanOrEqual(2)
      scaleVectorElementAroundCenter.mock.calls.forEach(
        ([elementId, geometry, options]) => {
          expect(elementId).toMatch(/^cat-element-\d+$/)
          expect(geometry).toEqual({
            scaleX: 1.2,
            scaleY: 1.2
          })
          expect(options).toMatchObject({
            undoable: true
          })
        }
      )
      expect(updatePrimaryFillColors).toHaveBeenCalledOnce()
      updatePrimaryFillColors.mock.calls.forEach(([updates, options]) => {
        expect(updates).toHaveLength(2)
        updates.forEach(({ color, elementId }) => {
          expect(elementId).toMatch(/^cat-element-\d+$/)
          expect(color).toBe('#DC2626')
        })
        expect(options).toEqual({
          sharedDelivery: 'transaction-end',
          undoable: true
        })
      })
      expect(updatePrimaryFillColor).not.toHaveBeenCalled()
      expect(transactionApis.runTransaction).toHaveBeenCalledTimes(3)
    } finally {
      await conversation.dispose()
      registration.dispose()
      await runtime.dispose()
      await provider.dispose()
    }
  })

  it('waits for one visible app confirmation and opens no transaction on denial', async () => {
    prepareCommonApis()
    vi.mocked(elementApis.getElementType).mockReturnValue('group')
    vi.spyOn(hierarchyApis, 'removeSubtree').mockReturnValue({
      removed: [
        {
          depth: 0,
          elementId: 'group-cat',
          index: 0,
          parentId: 'workspace-1'
        }
      ],
      rootId: 'group-cat'
    })
    const provider: AiProvider = {
      generateActionPlan: vi.fn(async () => ({
        actions: [
          {
            arguments: {
              compositionId: 'group-cat'
            },
            id: 'remove-cat',
            name: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION
          }
        ],
        planId: 'remove-plan'
      }))
    }
    const confirmation = createAsyraDesignAiConfirmationBroker()
    const pending = createDeferred<undefined>()
    const unsubscribe = confirmation.subscribe((snapshot) => {
      if (snapshot.pending) {
        pending.resolve(undefined)
      }
    })
    const runtime = createAiAgentRuntime(
      createAsyraDesignAiRuntimeInput({
        permissionRules: {
          [AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION]: 'confirm'
        },
        provider,
        requestConfirmation: confirmation.requestConfirmation
      })
    )
    const registration = registerAiAgentFeature({
      providerEnabled: true,
      runtime
    })
    const feature = getFeature(FeatureNames.AI_AGENT) as AiAgentFeatureApi
    const conversation = createAsyraDesignAiConversationController({
      confirmation,
      createConversationId: () => 'confirmation-conversation',
      feature,
      getElementType: (elementId) => elementApis.getElementType(elementId)
    })

    try {
      const settlement = conversation.submit('delete')
      await pending.promise

      expect(confirmation.getSnapshot().pending).toMatchObject({
        summary: {
          actionKind: 'delete',
          destructive: true,
          undoable: true
        },
        turnId: 'confirmation-conversation:turn:1'
      })
      expect(confirmation.resolve(false)).toBe(true)
      await expect(settlement).resolves.toMatchObject({
        outcome: 'cancelled'
      })
      expect(transactionApis.runTransaction).not.toHaveBeenCalled()
      expect(hierarchyApis.removeSubtree).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
      await conversation.dispose()
      registration.dispose()
      await runtime.dispose()
      await confirmation.dispose()
    }
  })
})
