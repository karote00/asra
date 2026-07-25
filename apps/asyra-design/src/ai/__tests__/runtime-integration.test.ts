import {
  createAiAgentRuntime,
  createGenericHttpAiProvider,
  type AiProvider
} from '@asyra/ai-agent-runtime'
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
})
