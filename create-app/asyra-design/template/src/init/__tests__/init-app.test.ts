import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionBatch } from '@asyra/ai-agent-runtime'
import * as preset from '@asyra/preset'
import core from '../../contexts'
import * as areaSelection from '../capabilities/init-area-selection'
import * as gradientFillEditing from '../capabilities/init-gradient-fill-editing'
import * as vectorIconData from '../capabilities/init-vector-icon-data'
import * as canvasPipelineDebugger from '../diagnostics/init-canvas-pipeline-debugger'
import * as loadDiagnostics from '../diagnostics/init-load-diagnostics'
import * as pathEditingContinuation from '../derived-state/init-path-editing-continuation'
import * as selectionCompatibility from '../derived-state/init-selection-compatibility'
import * as features from '../foundation/init-features'
import * as inputSystem from '../foundation/init-input-system'
import { elementApis } from '../../common-apis/element'
import { hierarchyApis } from '../../common-apis/hierarchy'
import { strokeApis } from '../../common-apis/strokes'
import { initApp } from '../init-app'
import * as aiStartup from '../../ai/startup'
import { startAsyraDesignApp } from '../../startup'

const calls: string[] = []
const createInitializedAiFeature = () => ({
  ai: {
    api: {
      cancel: vi.fn(() => false),
      execute: vi.fn(async () => ({
        reason: 'provider-disabled',
        status: 'unavailable'
      }))
    },
    dispose: vi.fn(() => true)
  }
})

describe('initApp preset composition', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    calls.length = 0
    vi.spyOn(preset, 'applyPreset').mockImplementation(() => {
      calls.push('preset')
      return Object.freeze({
        profile: preset.PresetProfiles.CUSTOM,
        presetEngineId: null,
        selectedDefaults: Object.freeze([]),
        appliedDefaults: Object.freeze([])
      })
    })
    vi.spyOn(
      canvasPipelineDebugger,
      'initCanvasPipelineDebugger'
    ).mockImplementation(() => {
      calls.push('canvas-pipeline-debugger')
      return Promise.resolve(undefined)
    })
    vi.spyOn(loadDiagnostics, 'initLoadDiagnostics').mockImplementation(() => {
      calls.push('diagnostics')
    })
    vi.spyOn(
      selectionCompatibility,
      'initSelectionCompatibility'
    ).mockImplementation(() => {
      calls.push('selection-compatibility')
    })
    vi.spyOn(
      pathEditingContinuation,
      'initPathEditingContinuation'
    ).mockImplementation(() => {
      calls.push('path-editing-continuation')
    })
    vi.spyOn(areaSelection, 'initAreaSelection').mockImplementation(() => {
      calls.push('area-selection')
    })
    vi.spyOn(gradientFillEditing, 'initGradientFillEditing').mockImplementation(
      () => {
        calls.push('gradient-fill-editing')
      }
    )
    vi.spyOn(vectorIconData, 'initVectorIconData').mockImplementation(() => {
      calls.push('vector-icon-data')
    })
    vi.spyOn(inputSystem, 'initInputSystem').mockImplementation(() => {
      calls.push('input-system')
    })
    vi.spyOn(features, 'initFeatures').mockImplementation(() => {
      calls.push('features')
      return createInitializedAiFeature()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.__AsyraE2E__
  })

  it('applies the default preset with the production AI lifecycle', async () => {
    const initialization = initApp({ serverResponse: null })

    expect(preset.applyPreset).toHaveBeenCalledOnce()
    expect(preset.applyPreset).toHaveBeenCalledWith(core)
    expect(features.initFeatures).toHaveBeenCalledWith({
      ai: {
        enabled: true,
        providerEnabled: true,
        runtime: expect.objectContaining({
          run: expect.any(Function)
        })
      }
    })
    expect(initialization.aiRuntime).toMatchObject({
      enabled: true,
      providerEnabled: true
    })
    expect(initialization.aiConfirmation).not.toBeNull()
    expect(initialization.aiHistory).not.toBeNull()
    expect(window.__AsyraE2E__).toEqual({
      elementApis,
      hierarchyApis,
      strokeApis
    })
    expect(calls).toEqual([
      'preset',
      'canvas-pipeline-debugger',
      'diagnostics',
      'selection-compatibility',
      'path-editing-continuation',
      'area-selection',
      'gradient-fill-editing',
      'vector-icon-data',
      'input-system',
      'features'
    ])

    await initialization.dispose()
  })

  it('passes the exact resident server response into AI startup', async () => {
    const batch = {
      actions: [],
      batchId: 'resident'
    } as const satisfies AiActionBatch
    const response = {
      batch,
      fileId: 'file-resident',
      schemaVersion: 1
    } as const
    const createAiStartup = vi.spyOn(aiStartup, 'createAsyraDesignAiStartup')

    const initialization = initApp({ serverResponse: response })

    expect(createAiStartup).toHaveBeenCalledWith({
      deliveryMode: 'progressive',
      response
    })

    await initialization.dispose()
  })

  it('fails startup instead of rendering an App without its required Agent feature', () => {
    vi.spyOn(features, 'initFeatures').mockReturnValue({
      ai: null
    })

    expect(() => initApp({ serverResponse: null })).toThrow(
      '[Asyra Design] Agent feature failed to initialize'
    )
  })

  it('constructs the complete production Agent composition by default', async () => {
    const disposeFeature = vi.fn(() => true)
    vi.spyOn(features, 'initFeatures').mockImplementation((options) => ({
      ai: options.ai?.enabled
        ? {
            api: {
              cancel: vi.fn(() => false),
              execute: vi.fn(async () => ({
                reason: 'provider-disabled',
                status: 'unavailable'
              }))
            },
            dispose: disposeFeature
          }
        : null
    }))
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')

    const initialization = initApp({ serverResponse: null })

    expect(initialization).toMatchObject({
      aiRuntime: {
        enabled: true,
        providerEnabled: true
      }
    })
    expect(initialization.aiConfirmation).not.toBeNull()
    expect(initialization.aiConversation).not.toBeNull()
    expect(initialization.aiHistory).not.toBeNull()
    expect(addEventListener).toHaveBeenCalledWith(
      'pagehide',
      expect.any(Function),
      {
        once: true
      }
    )

    await initialization.dispose()

    expect(removeEventListener).toHaveBeenCalledWith(
      'pagehide',
      expect.any(Function)
    )
    expect(initialization.aiConfirmation?.getSnapshot()).toMatchObject({
      disposed: true
    })
    expect(initialization.aiHistory?.getSnapshot()).toEqual({
      control: null,
      disposed: true
    })
    expect(disposeFeature).toHaveBeenCalledOnce()
  })
})

describe('Asyra Design outer startup', () => {
  const createInitialization = (): ReturnType<typeof initApp> =>
    ({
      aiConfirmation: {},
      aiConversation: {},
      aiHistory: {},
      aiRuntime: {},
      dispose: vi.fn()
    }) as ReturnType<typeof initApp>

  it('awaits one exact required-file response before initialization and render', async () => {
    let resolveResponse:
      | ((value: {
          readonly batch: AiActionBatch
          readonly fileId: string
          readonly schemaVersion: 1
        }) => void)
      | undefined
    const responsePromise = new Promise<{
      readonly batch: AiActionBatch
      readonly fileId: string
      readonly schemaVersion: 1
    }>((resolve) => {
      resolveResponse = resolve
    })
    const order: string[] = []
    const initialization = createInitialization()
    const render = vi.fn(() => {
      order.push('render')
    })
    const initializeApp = vi.fn(() => {
      order.push('init')
      return initialization
    })
    const readServerResponse = vi.fn(() => {
      order.push('read')
      return responsePromise
    })
    const getRequiredFileId = vi.fn(() => {
      order.push('fileId')
      return 'file-fast-16'
    })
    const start = startAsyraDesignApp(
      {
        deliveryMode: 'progressive',
        render
      },
      {
        getRequiredFileId,
        initializeApp,
        readServerResponse
      }
    )

    await Promise.resolve()
    expect(order).toEqual(['fileId', 'read'])
    expect(initializeApp).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()

    const response = {
      batch: {
        actions: [],
        batchId: 'resident-batch'
      },
      fileId: 'file-fast-16',
      schemaVersion: 1
    } as const
    resolveResponse?.(response)

    await expect(start).resolves.toBe(initialization)
    expect(order).toEqual(['fileId', 'read', 'init', 'render'])
    expect(readServerResponse).toHaveBeenCalledOnce()
    expect(readServerResponse).toHaveBeenCalledWith('file-fast-16')
    expect(initializeApp).toHaveBeenCalledWith({
      aiDeliveryMode: 'progressive',
      serverResponse: response
    })
    expect(render).toHaveBeenCalledWith(initialization)
  })

  it('does not initialize or render when required file identity fails', async () => {
    const initializeApp = vi.fn()
    const readServerResponse = vi.fn()
    const render = vi.fn()

    await expect(
      startAsyraDesignApp(
        {
          deliveryMode: 'progressive',
          render
        },
        {
          getRequiredFileId: () => {
            throw new Error('[collaboration] missing required fileId')
          },
          initializeApp,
          readServerResponse
        }
      )
    ).rejects.toThrow('[collaboration] missing required fileId')
    expect(readServerResponse).not.toHaveBeenCalled()
    expect(initializeApp).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })

  it('does not initialize or render when the response read fails', async () => {
    const initialization = createInitialization()
    const initializeApp = vi.fn(() => initialization)
    const readServerResponse = vi.fn(async () => {
      throw new Error('response-read-failed')
    })
    const render = vi.fn()

    await expect(
      startAsyraDesignApp(
        {
          deliveryMode: 'progressive',
          render
        },
        {
          getRequiredFileId: () => 'file-fast-16',
          initializeApp,
          readServerResponse
        }
      )
    ).rejects.toThrow('response-read-failed')
    expect(readServerResponse).toHaveBeenCalledOnce()
    expect(initializeApp).not.toHaveBeenCalled()
    expect(render).not.toHaveBeenCalled()
  })
})
