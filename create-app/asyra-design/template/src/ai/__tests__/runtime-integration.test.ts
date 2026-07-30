import {
  createAiAgentRuntime,
  type AiActionBatch,
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
import { createAsyraDesignAiRuntimeInput } from '../runtime-input'

const referenceBatch = (): AiActionBatch => ({
  actions: [
    {
      arguments: {
        elementId: 'shape-1',
        visible: false
      },
      id: 'visibility-1',
      name: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      summary: {
        affectedCount: 1
      }
    },
    {
      arguments: {
        elementIds: ['shape-1', 'shape-2']
      },
      id: 'selection-1',
      name: AsyraDesignAiActionNames.SELECT_ELEMENTS,
      summary: {
        affectedCount: 2
      }
    }
  ],
  batchId: 'reference-batch',
  explanation: 'Update the current selection.'
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
    height: 80,
    width: 100,
    x: 10,
    y: 20
  })
  vi.spyOn(elementApis, 'setElementVisible').mockReturnValue(true)
  vi.spyOn(transactionApis, 'runTransaction').mockImplementation((execute) =>
    execute()
  )
}

const executeBatch = async (provider: AiProvider) => {
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
      intent: 'execute the server-prepared batch',
      signal: new AbortController().signal
    })
  } finally {
    await runtime.dispose()
  }
}

describe('Asyra Design server action-batch runtime integration', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs one server-prepared batch through one common transaction and bounded preview', async () => {
    prepareCommonApis()
    const batch = referenceBatch()
    const provider: AiProvider = {
      requestActionBatch: vi.fn(async () => batch)
    }

    const result = await executeBatch(provider)

    expect(result).toMatchObject({
      actionResults: [
        {
          actionName: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY
        },
        {
          actionName: AsyraDesignAiActionNames.SELECT_ELEMENTS
        }
      ],
      batchId: 'reference-batch',
      status: 'executed',
      transaction: {
        status: 'committed'
      }
    })
    if (result.status !== 'executed') {
      throw new Error('Expected the server-prepared action batch to execute.')
    }
    expect(result.preview.actions).toEqual([
      {
        id: 'visibility-1',
        name: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
        permission: 'allow',
        summary: {
          affectedCount: 1
        }
      },
      {
        id: 'selection-1',
        name: AsyraDesignAiActionNames.SELECT_ELEMENTS,
        permission: 'allow',
        summary: {
          affectedCount: 2
        }
      }
    ])
    expect(result.preview.batchId).toBe('reference-batch')
    expect(JSON.stringify(result.preview)).not.toMatch(
      /arguments|elementIds|shape-1|shape-2/
    )
    expect(provider.requestActionBatch).toHaveBeenCalledOnce()
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
})
