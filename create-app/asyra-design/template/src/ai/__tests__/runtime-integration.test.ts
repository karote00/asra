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
import { AiActionNames } from '../actions'
import { createAiRuntimeInput } from '../runtime-input'
import { createAiConfirmationBroker } from '../confirmation'
import { createDeferred } from './deferred'

const referenceBatch = (): AiActionBatch => ({
  actions: [
    {
      arguments: {
        elementId: 'shape-1',
        visible: false
      },
      id: 'visibility-1',
      name: AiActionNames.SET_ELEMENT_VISIBILITY,
      summary: {
        affectedCount: 1
      }
    },
    {
      arguments: {
        elementIds: ['shape-1', 'shape-2']
      },
      id: 'selection-1',
      name: AiActionNames.SELECT_ELEMENTS,
      summary: {
        affectedCount: 2
      }
    }
  ],
  batchId: 'reference-batch',
  explanation: 'Update the current selection.'
})

const providerForBatch = (batch: AiActionBatch): AiProvider => ({
  requestActionBatch: vi.fn(async () => batch)
})

const compact16ItemBatch = (): AiActionBatch => {
  const descriptors = Array.from({ length: 16 }, (_, index) => ({
    fills: [],
    height: 10,
    id: `element-${index}`,
    lock: false,
    name: `Item ${index}`,
    props: {
      dimension: `element-${index}-dimension`,
      position: `element-${index}-position`
    },
    strokes: [],
    type: 'oval',
    visible: true,
    width: 10,
    x: index * 10,
    y: 0
  }))
  const roles = descriptors.map((_, index) => `item-${index}`)

  return {
    actions: [
      {
        arguments: {
          artifactVersion: 1,
          compositionRole: 'runtime-integration-16',
          elementCount: descriptors.length,
          groupBounds: {
            height: 40,
            width: 160,
            x: 0,
            y: 0
          },
          groupDescriptor: {
            children: [],
            fills: [],
            height: 40,
            id: 'cat-group',
            lock: false,
            name: 'Runtime integration group',
            props: {
              dimension: 'cat-group-dimension',
              position: 'cat-group-position'
            },
            strokes: [],
            type: 'group',
            visible: true,
            width: 160,
            x: 0,
            y: 0
          },
          parent: 'workspace',
          pointCount: 0,
          roleToElementIds: Object.fromEntries(
            roles.map((role, index) => [role, [`element-${index}`]])
          ),
          skipped: [],
          slices: [
            {
              descriptors,
              pointCount: 0,
              roles
            }
          ]
        },
        id: 'insert-16',
        name: AiActionNames.INSERT_VECTOR_COMPOSITION,
        summary: {
          affectedCount: 16,
          skippedCount: 0
        }
      }
    ],
    batchId: 'composition-batch-16'
  }
}

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

const executeBatch = async (batch: AiActionBatch) => {
  const provider = providerForBatch(batch)
  const runtime = createAiAgentRuntime(
    createAiRuntimeInput({
      permissionRules: {
        [AiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow',
        [AiActionNames.SELECT_ELEMENTS]: 'allow',
        [AiActionNames.SET_ELEMENT_VISIBILITY]: 'allow'
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

describe('Design App server action-batch runtime integration', () => {
  beforeEach(() => {
    prepareCommonApis()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs the requested backend batch through one common transaction with bounded preview', async () => {
    const result = await executeBatch(referenceBatch())

    expect(result).toMatchObject({
      actionResults: [
        {
          actionName: AiActionNames.SET_ELEMENT_VISIBILITY
        },
        {
          actionName: AiActionNames.SELECT_ELEMENTS
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
        name: AiActionNames.SET_ELEMENT_VISIBILITY,
        permission: 'allow',
        summary: {
          affectedCount: 1
        }
      },
      {
        id: 'selection-1',
        name: AiActionNames.SELECT_ELEMENTS,
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
    vi.spyOn(elementApis, 'createElementsInParent').mockImplementation(
      (descriptors) => descriptors.map(({ id }) => id)
    )

    await expect(executeBatch(compact16ItemBatch())).resolves.toMatchObject({
      actionResults: [
        {
          actionName: AiActionNames.INSERT_VECTOR_COMPOSITION,
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
    expect(elementApis.createElementsInParent).toHaveBeenCalledTimes(2)
    expect(
      vi.mocked(elementApis.createElementsInParent).mock.calls[0]?.[0]
    ).toEqual([expect.objectContaining({ id: 'cat-group', type: 'group' })])
    expect(
      vi.mocked(elementApis.createElementsInParent).mock.calls[0]?.[1]
    ).toBe('workspace-1')
    expect(
      vi.mocked(elementApis.createElementsInParent).mock.calls[1]?.[0]
    ).toHaveLength(16)
    expect(
      vi.mocked(elementApis.createElementsInParent).mock.calls[1]?.[1]
    ).toBe('cat-group')
  })

  it('requests the provider only when the Runtime turn starts', async () => {
    const provider = providerForBatch(referenceBatch())
    const runtime = createAiAgentRuntime(
      createAiRuntimeInput({
        permissionRules: {
          [AiActionNames.SELECT_ELEMENTS]: 'allow',
          [AiActionNames.SET_ELEMENT_VISIBILITY]: 'allow'
        },
        provider
      })
    )
    expect(provider.requestActionBatch).not.toHaveBeenCalled()

    try {
      await expect(
        runtime.run({
          intent: 'request the backend batch',
          signal: new AbortController().signal
        })
      ).resolves.toMatchObject({ status: 'executed' })
      expect(provider.requestActionBatch).toHaveBeenCalledOnce()
    } finally {
      await runtime.dispose()
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
          name: AiActionNames.REMOVE_AI_COMPOSITION,
          summary: {
            affectedCount: 1
          }
        }
      ],
      batchId: 'remove-batch'
    }
    const provider: AiProvider = providerForBatch(batch)
    const confirmation = createAiConfirmationBroker()
    const pending = createDeferred<undefined>()
    const unsubscribe = confirmation.subscribe((snapshot) => {
      if (snapshot.pending) {
        pending.resolve(undefined)
      }
    })
    const runtime = createAiAgentRuntime(
      createAiRuntimeInput({
        permissionRules: {
          [AiActionNames.REMOVE_AI_COMPOSITION]: 'confirm'
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
