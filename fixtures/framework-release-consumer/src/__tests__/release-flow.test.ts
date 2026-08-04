import { describe, expect, it, vi } from 'vitest'

const CHANNEL = 'document'
const SET_VALUE = 'release-consumer:set-value'

const createNullRenderer = () => ({
  name: 'release-consumer-headless-renderer',
  init: async () => ({ canvas: null, instance: null }),
  destroy: () => undefined,
  getViewportPosition: () => ({ x: 0, y: 0 }),
  getViewportScale: () => 1,
  setViewportPosition: () => undefined,
  setViewportScale: () => undefined,
  resize: () => undefined,
  getCanvas: () => null,
  getInstance: () => null
})

describe.sequential('packed framework public release flow', () => {
  it('keeps optional Collaboration and AI inert when only Core and Preset are composed', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('unexpected network request'))
    const intervalSpy = vi.spyOn(globalThis, 'setInterval')
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const OriginalWebSocket = globalThis.WebSocket
    const websocketConstructor = vi.fn()
    globalThis.WebSocket = vi.fn((...args: unknown[]) => {
      websocketConstructor(...args)
    }) as unknown as typeof WebSocket

    try {
      await import('@asyra/core')
      await import('@asyra/preset')

      expect(fetchSpy).not.toHaveBeenCalled()
      expect(intervalSpy).not.toHaveBeenCalled()
      expect(websocketConstructor).not.toHaveBeenCalled()
    } finally {
      globalThis.WebSocket = OriginalWebSocket
      vi.restoreAllMocks()
    }
  })

  it('initializes Core with Preset 2D and exercises migration, Group, and undo/redo through public APIs', async () => {
    const [{ default: core }, { default: factory }, preset] = await Promise.all(
      [import('@asyra/core'), import('@asyra/factory'), import('@asyra/preset')]
    )
    const migratedVersions: string[] = []

    core.setRenderer(createNullRenderer())
    core.registerLoadHook((rawDocument) => {
      const document = rawDocument as {
        version: string
        [key: string]: unknown
      }
      migratedVersions.push(document.version)
      return document.version === '0.1.0'
        ? { ...document, version: '1.0.0' }
        : document
    })
    const applied = preset.applyPreset(core)
    expect(applied.profile).toBe(preset.PresetProfiles['2D'])
    expect(core.hasRenderEngineProvider()).toBe(true)

    core.sceneTreeInit()
    await core.start(document.createElement('div'), {
      width: 320,
      height: 240
    })

    const workspaceId = core.sceneTreeSaveData().workspace
    const firstId = core.createElementInParent(
      {
        type: preset.RECTANGLE_COMPONENT_DEFINITION.type,
        x: 10,
        y: 20,
        width: 30,
        height: 40
      },
      workspaceId
    )
    const secondId = core.createElementInParent(
      {
        type: preset.RECTANGLE_COMPONENT_DEFINITION.type,
        x: 60,
        y: 80,
        width: 20,
        height: 10
      },
      workspaceId
    )
    const historyBeforeGroup = factory.getUndoHistoryDepth()
    const grouped = preset.groupElements(core, [firstId, secondId])

    expect(grouped.elementIds).toEqual([firstId, secondId])
    expect(factory.getUndoHistoryDepth()).toBe(historyBeforeGroup + 1)
    expect(
      (
        core.sceneTreeSaveData().elements[grouped.groupId] as {
          children: string[]
        }
      ).children
    ).toEqual([firstId, secondId])

    factory.undo()
    expect(core.sceneTreeSaveData().elements[grouped.groupId]).toBeUndefined()
    factory.redo()
    expect(
      (
        core.sceneTreeSaveData().elements[grouped.groupId] as {
          children: string[]
        }
      ).children
    ).toEqual([firstId, secondId])

    const ungrouped = preset.ungroupElement(core, grouped.groupId)
    expect(ungrouped).toMatchObject({
      groupId: grouped.groupId,
      elementIds: [firstId, secondId],
      removed: true
    })

    const saved = await core.save()
    core.load({ ...saved, version: '0.1.0' })
    expect(migratedVersions).toContain('0.1.0')
    expect(await core.save()).toMatchObject({
      version: '1.0.0',
      sceneTree: {
        workspace: workspaceId
      }
    })

    core.destroyRenderer()
  })

  it('converges two opt-in peers and executes one AI plan through an app-owned Feature and transaction', async () => {
    const [
      collaborationModule,
      factoryModule,
      featureSystem,
      aiAgentRuntime,
      reactiveEvents
    ] = await Promise.all([
      import('@asyra/collaboration'),
      import('@asyra/factory'),
      import('@asyra/feature-system'),
      import('@asyra/ai-agent-runtime'),
      import('@asyra/reactive-events')
    ])
    const hub = new collaborationModule.MemoryHub()

    const createPeer = async (actorId: string) => {
      const factory = new factoryModule.Factory()
      factory.registerSharedDataChannel(
        CHANNEL,
        new factoryModule.LocalSharedDataChannel()
      )
      const state = { value: 0 }
      factory.registerTransactionInverter(SET_VALUE, (event) => {
        const payload = (
          event as unknown as {
            payload: { before: number; after: number }
          }
        ).payload
        return {
          type: event.type,
          payload: {
            ...payload,
            before: payload.after,
            after: payload.before
          }
        }
      })
      factory.registerTransactionReplayHandler(SET_VALUE, (event) => {
        state.value = (
          event as unknown as { payload: { after: number } }
        ).payload.after
        return true
      })
      const recordAndApply = (after: number) => {
        factory.updateTransaction({
          type: reactiveEvents.EventTypes.UPDATE_TRANSACTION,
          eventName: SET_VALUE,
          payload: { before: state.value, after },
          options: {
            undoable: true,
            rollbackable: true,
            shared: CHANNEL,
            sharedDelivery: 'transaction-end'
          }
        })
        state.value = after
      }
      const provider = new collaborationModule.MemoryProvider(hub, {
        documentId: 'release-document',
        roomId: 'release-room',
        actorId
      })
      const collaboration = collaborationModule.createCollaboration({
        documentId: 'release-document',
        roomId: 'release-room',
        actorId,
        factory,
        provider,
        processRemotePublication: (publication) => {
          const deliveries = publication.slices.flatMap((slice) =>
            slice.batches.flatMap((batch) =>
              batch.deliveries.map((delivery) => ({
                channel: batch.channel,
                delivery
              }))
            )
          )
          factory.runRemoteTransaction(() => {
            deliveries.forEach(({ channel, delivery }) => {
              if (channel !== CHANNEL || delivery.eventName !== SET_VALUE) {
                throw new Error('Unexpected release consumer publication')
              }
              recordAndApply((delivery.payload as { after: number }).after)
            })
          })
        },
        resourceOwnership: { provider: 'owned' }
      })
      await collaboration.start()
      return {
        collaboration,
        factory,
        getValue: () => state.value,
        recordAndApply,
        setValue: (after: number) => {
          factory.startTransaction()
          recordAndApply(after)
          factory.endTransaction()
        }
      }
    }

    const first = await createPeer('release-peer-1')
    const second = await createPeer('release-peer-2')
    first.setValue(5)
    await first.collaboration.whenIdle()
    await second.collaboration.whenIdle()
    expect(second.getValue()).toBe(5)

    const runtime = aiAgentRuntime.createAiAgentRuntime({
      provider: {
        requestActionBatch: async () => ({
          batchId: 'release-ai-batch',
          actions: [
            {
              id: 'release-ai-action',
              name: 'set_counter',
              arguments: { value: 9 },
              summary: { affectedCount: 1, kind: 'counter' }
            }
          ]
        })
      },
      actionDefinitions: [
        {
          name: 'set_counter',
          description: 'Set the collaborating counter.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['value'],
            properties: { value: { type: 'number' } }
          },
          execute: async ({ value }: { value: number }) => {
            first.recordAndApply(value)
            return { value }
          }
        }
      ],
      contextProvider: {
        getContext: async () => ({ currentValue: first.getValue() })
      },
      permissionPolicy: {
        evaluate: async () => 'allow' as const
      },
      confirmationHandler: {
        confirm: async () => true
      },
      transactionRunner: {
        run: async (_label, execute) => {
          first.factory.startTransaction()
          const result = await execute()
          first.factory.endTransaction()
          return result
        }
      }
    })
    const featureName = 'release-consumer-ai'
    const api = {
      execute: (intent: string) =>
        featureSystem.invokeFeatureTask<
          { intent: string },
          Awaited<ReturnType<typeof runtime.run>>
        >(featureName, { intent })
    }
    const feature = featureSystem.defineFeature<
      typeof api,
      Record<string, never>,
      { intent: string },
      Awaited<ReturnType<typeof runtime.run>>
    >(featureName, undefined, {
      priority: 100,
      exclusive: true,
      api,
      task: ({ intent }, { signal }) => runtime.run({ intent, signal })
    })
    const historyBeforeAi = first.factory.getUndoHistoryDepth()
    const result = await feature.api.execute('set the counter to nine')

    await first.collaboration.whenIdle()
    await second.collaboration.whenIdle()
    expect(result.status).toBe('executed')
    expect(first.getValue()).toBe(9)
    expect(second.getValue()).toBe(9)
    expect(first.factory.getUndoHistoryDepth()).toBe(historyBeforeAi + 1)

    first.factory.undo()
    await first.collaboration.whenIdle()
    await second.collaboration.whenIdle()
    expect(first.getValue()).toBe(5)
    expect(second.getValue()).toBe(5)

    expect(feature.dispose()).toBe(true)
    await runtime.dispose()
    await first.collaboration.dispose()
    await second.collaboration.dispose()
  })
})
