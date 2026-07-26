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
  hierarchyApis,
  selectionApis,
  systemContextApis,
  transactionApis
} from '../../common-apis'
import { AsyraDesignAiActionNames } from '../actions'
import { createAsyraDesignAiRuntimeInput } from '../composition'
import { createAsyraDesignAiConversationController } from '../conversation'
import { createAsyraDesignAiConfirmationBroker } from '../confirmation'
import {
  AsyraDesignMockAiPhrases,
  createAsyraDesignMockAiProvider
} from '../mock-provider'
import {
  registerAiAgentFeature,
  type AiAgentFeatureApi
} from '../../features/ai-agent'
import { FeatureNames } from '../../constants'

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

const executeReferencePlan = async (provider: AiProvider) => {
  const runtime = createAiAgentRuntime(
    createAsyraDesignAiRuntimeInput({
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
  createElement: () => string | null
) => {
  const provider = createAsyraDesignMockAiProvider({
    delay: async () => undefined
  })
  vi.spyOn(elementApis, 'createElement').mockImplementation(createElement)
  vi.spyOn(hierarchyApis, 'groupElements').mockReturnValue({
    bounds: {
      height: 320,
      width: 440,
      x: 460,
      y: 158
    },
    elementIds: [],
    groupId: 'cat-face-group'
  })
  const runtime = createAiAgentRuntime(
    createAsyraDesignAiRuntimeInput({
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
    expect(elementApis.createElement).toHaveBeenCalledTimes(16)
    expect(hierarchyApis.groupElements).toHaveBeenCalledOnce()
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
                role: 'right-whisker-2'
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
    expect(elementApis.createElement).toHaveBeenCalledTimes(16)
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
    vi.spyOn(elementApis, 'createElement').mockImplementation(
      () => `cat-element-${(nextElement += 1)}`
    )
    vi.spyOn(elementApis, 'changeElementGeometry').mockImplementation(
      () => undefined
    )
    vi.spyOn(hierarchyApis, 'groupElements').mockReturnValue({
      bounds: {
        height: 320,
        width: 440,
        x: 460,
        y: 158
      },
      elementIds: [],
      groupId: 'cat-face-group'
    })
    vi.mocked(elementApis.getElementType).mockImplementation((elementId) => {
      if (elementId === 'cat-face-group') {
        return 'group'
      }
      if (elementId === 'cat-element-4' || elementId === 'cat-element-5') {
        return 'oval'
      }
      return elementId.startsWith('cat-element-') ? 'vector' : undefined
    })
    vi.mocked(elementApis.getElementBounds).mockReturnValue({
      height: 70,
      width: 58,
      x: 594,
      y: 300
    })
    const runtime = createAiAgentRuntime(
      createAsyraDesignAiRuntimeInput({
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

      expect(elementApis.createElement).toHaveBeenCalledTimes(16)
      expect(elementApis.changeElementGeometry).toHaveBeenCalledTimes(2)
      expect(elementApis.changeElementGeometry).toHaveBeenNthCalledWith(
        1,
        'cat-element-4',
        expect.any(Object),
        expect.any(Object)
      )
      expect(elementApis.changeElementGeometry).toHaveBeenNthCalledWith(
        2,
        'cat-element-5',
        expect.any(Object),
        expect.any(Object)
      )
      expect(transactionApis.runTransaction).toHaveBeenCalledTimes(2)
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
    const pending = Promise.withResolvers<undefined>()
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
