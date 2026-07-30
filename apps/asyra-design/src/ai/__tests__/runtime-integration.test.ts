import type { AiActionBatch, AiProvider } from '@asyra/ai-agent-runtime'
import { createAiAgentRuntime } from '@asyra/ai-agent-runtime'
import { MouseButton, SystemMode } from '@asyra/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  elementApis,
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
import { createAsyraDesignAiConfirmationBroker } from '../confirmation'
import { createAsyraDesignServerActionBatchProvider } from '../server-action-batch-provider'
import type { AsyraDesignServerResponseRecord } from '../server-response-inbox'
import { createAsyraDesignAiStartup } from '../startup'
import { createDeferred } from './deferred'

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

const serverResponse = (
  batch: AiActionBatch,
  fileId = `file-${batch.batchId}`
): AsyraDesignServerResponseRecord => ({
  batch,
  fileId,
  schemaVersion: 1
})

const compact16ItemBatch = (): AiActionBatch => ({
  actions: [
    {
      arguments: {
        artifactVersion: 1,
        compositionRole: 'runtime-integration-16',
        coordinates: new ArrayBuffer(0),
        groupBounds: {
          height: 40,
          width: 160,
          x: 0,
          y: 0
        },
        items: Array.from({ length: 16 }, (_, index) => ({
          bounds: {
            height: 10,
            width: 10,
            x: index * 10,
            y: 0
          },
          pathCount: 0,
          pathStart: 0,
          pointCount: 0,
          primitive: 'oval',
          role: `item-${index}`,
          style: {}
        })),
        parent: 'workspace',
        paths: [],
        pointCount: 0,
        skipped: []
      },
      id: 'insert-16',
      name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      summary: {
        affectedCount: 16,
        skippedCount: 0
      }
    }
  ],
  batchId: 'composition-batch-16'
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
  vi.spyOn(systemContextApis, 'setAiDrawingProgress').mockImplementation(
    () => undefined
  )
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

const executeBatch = async (
  batch: AiActionBatch,
  deliveryMode: AsyraDesignAiDeliveryMode = 'atomic'
) => {
  const provider = createAsyraDesignServerActionBatchProvider(
    serverResponse(batch)
  )
  const runtime = createAiAgentRuntime(
    createAsyraDesignAiRuntimeInput({
      deliveryMode,
      permissionRules: {
        [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow',
        [AsyraDesignAiActionNames.SELECT_ELEMENTS]: 'allow',
        [AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY]: 'allow'
      },
      provider
    })
  )

  try {
    return await runtime.run({
      intent: 'execute the resident server response',
      signal: new AbortController().signal
    })
  } finally {
    await runtime.dispose()
  }
}

describe('Asyra Design server action-batch runtime integration', () => {
  beforeEach(() => {
    prepareCommonApis()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs the resident batch through one common transaction with bounded preview', async () => {
    const result = await executeBatch(referenceBatch())

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
      throw new Error('Expected the resident action batch to execute.')
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
    expect(JSON.stringify(result.preview)).not.toMatch(
      /arguments|elementIds|shape-1|shape-2/
    )
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

  it('uses ordinary immediate delivery for one progressive runtime batch', async () => {
    await expect(
      executeBatch(referenceBatch(), 'progressive')
    ).resolves.toMatchObject({
      batchId: 'reference-batch',
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

  it('creates the inline 16-item server response in one Group and one outer transaction', async () => {
    vi.spyOn(elementApis, 'createElement').mockReturnValue('cat-group')
    vi.spyOn(elementApis, 'createElementsInParent').mockImplementation(
      (options) => options.map((_option, index) => `element-${index}`)
    )

    await expect(executeBatch(compact16ItemBatch())).resolves.toMatchObject({
      actionResults: [
        {
          actionName: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
          result: {
            appliedElementIds: expect.arrayContaining([
              'element-0',
              'element-15'
            ]),
            compositionId: 'cat-group',
            status: 'complete'
          }
        }
      ],
      batchId: 'composition-batch-16',
      status: 'executed'
    })

    expect(transactionApis.runTransaction).toHaveBeenCalledOnce()
    expect(elementApis.createElement).toHaveBeenCalledOnce()
    expect(elementApis.createElementsInParent).toHaveBeenCalledOnce()
    expect(
      vi.mocked(elementApis.createElementsInParent).mock.calls[0]?.[0]
    ).toHaveLength(16)
  })

  it('keeps AI enabled without a resident response and fails only on request', async () => {
    const startup = createAsyraDesignAiStartup({
      deliveryMode: 'progressive',
      response: null
    })
    const createRuntimeInput = startup.runtimeOptions.createRuntimeInput
    if (!createRuntimeInput) {
      throw new Error('Agent startup must provide one runtime input.')
    }
    const runtime = createAiAgentRuntime(createRuntimeInput())

    try {
      await expect(
        runtime.run({
          intent: 'draw without a prepared response',
          signal: new AbortController().signal
        })
      ).resolves.toMatchObject({
        code: 'AI_PROVIDER_INVALID_CONFIGURATION',
        stage: 'provider',
        status: 'failed'
      })
    } finally {
      await runtime.dispose()
      await startup.confirmation.dispose()
      startup.history.dispose()
    }
  })

  it('waits for visible confirmation and opens no transaction on denial', async () => {
    vi.mocked(elementApis.getElementType).mockReturnValue('group')
    const batch: AiActionBatch = {
      actions: [
        {
          arguments: {
            compositionId: 'group-cat'
          },
          id: 'remove-cat',
          name: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
          summary: {
            affectedCount: 1
          }
        }
      ],
      batchId: 'remove-batch'
    }
    const provider: AiProvider = createAsyraDesignServerActionBatchProvider(
      serverResponse(batch)
    )
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
    confirmation.beginTurn('remove-turn')

    try {
      const settlement = runtime.run({
        intent: 'delete the selected group',
        signal: new AbortController().signal
      })
      await pending.promise

      expect(confirmation.getSnapshot().pending).toMatchObject({
        batchId: 'remove-batch',
        summary: {
          actionKind: 'delete',
          destructive: true,
          undoable: true
        }
      })
      expect(confirmation.resolve(false)).toBe(true)
      await expect(settlement).resolves.toMatchObject({
        audit: {
          batchId: 'remove-batch'
        },
        reason: 'confirmation-cancelled',
        status: 'cancelled'
      })
      expect(transactionApis.runTransaction).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
      await runtime.dispose()
      await confirmation.dispose()
    }
  })
})
