import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as preset from '@asyra/preset'
import core from '../../contexts'
import * as areaSelection from '../capabilities/init-area-selection'
import * as aiDrawingProgress from '../capabilities/init-ai-drawing-progress'
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
import * as aiDrawingPerformance from '../performance/ai-drawing-performance-profile'

const calls: string[] = []

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
    vi.spyOn(aiDrawingProgress, 'initAiDrawingProgress').mockImplementation(
      () => {
        calls.push('ai-drawing-progress')
      }
    )
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
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.__AsyraE2E__
    delete window.__AsyraAiDrawingPerformance__
  })

  it('applies the default preset with the production Mock AI lifecycle', async () => {
    const initialization = initApp()

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
      'ai-drawing-progress',
      'gradient-fill-editing',
      'vector-icon-data',
      'input-system',
      'features'
    ])

    await initialization.dispose()
  })

  it('routes provider-disabled AI to Feature initialization without a runtime', async () => {
    const initialization = initApp({
      ai: {
        enabled: true,
        providerEnabled: false
      }
    })

    expect(features.initFeatures).toHaveBeenCalledWith({
      ai: {
        enabled: true,
        providerEnabled: false,
        runtime: undefined
      }
    })
    expect(initialization.aiRuntime).toMatchObject({
      enabled: true,
      providerEnabled: false,
      runtime: null
    })

    await initialization.dispose()
  })

  it('composes and disposes one app-local conversation around the registered AI Feature', async () => {
    const execute = vi.fn(async () => ({
      reason: 'provider-disabled',
      status: 'unavailable'
    }))
    const cancel = vi.fn(() => false)
    const disposeFeature = vi.fn(() => true)
    vi.spyOn(features, 'initFeatures').mockReturnValue({
      ai: {
        api: {
          cancel,
          execute
        },
        dispose: disposeFeature
      }
    } as never)

    const initialization = initApp({
      ai: {
        enabled: true,
        providerEnabled: false
      }
    })

    expect(initialization.aiConversation).not.toBeNull()
    await expect(
      initialization.aiConversation?.submit('畫一個貓臉')
    ).resolves.toMatchObject({
      outcome: 'unavailable'
    })

    await initialization.dispose()

    expect(disposeFeature).toHaveBeenCalledOnce()
    expect(initialization.aiConversation?.getSnapshot()).toMatchObject({
      disposed: true
    })
  })

  it('constructs the complete production mock composition by default', async () => {
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

    const initialization = initApp()

    expect(initialization).toMatchObject({
      aiMode: 'mock',
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

  it('attaches and disposes exact-profile runtime evidence through read-only owners', async () => {
    const detachRuntimeEvidence = vi.fn()
    const readProjectedElementCount = vi
      .spyOn(core.deps.render, 'getProjectedElementCount')
      .mockReturnValue(7)
    const readUndoHistoryDepth = vi
      .spyOn(core.deps.factory, 'getUndoHistoryDepth')
      .mockReturnValue(3)
    const attachRuntimeEvidence = vi
      .spyOn(aiDrawingPerformance, 'attachAiDrawingPerformanceRuntimeEvidence')
      .mockReturnValue(detachRuntimeEvidence)
    window.__AsyraAiDrawingPerformance__ = {} as never

    const initialization = initApp()

    expect(attachRuntimeEvidence).toHaveBeenCalledOnce()
    expect(attachRuntimeEvidence).toHaveBeenCalledWith(
      window.__AsyraAiDrawingPerformance__,
      {
        readCanonicalElementCount: expect.any(Function),
        readCanonicalElements: expect.any(Function),
        readCanonicalOwnerSnapshot: expect.any(Function),
        readHistoryDepth: expect.any(Function),
        readRenderProjectionElementCount: expect.any(Function),
        subscribeToTransactionStatus: expect.any(Function)
      }
    )
    const runtimeSource = attachRuntimeEvidence.mock.calls[0][1]
    expect(runtimeSource.readHistoryDepth()).toBe(3)
    expect(runtimeSource.readRenderProjectionElementCount()).toBe(7)
    expect(readUndoHistoryDepth).toHaveBeenCalledOnce()
    expect(readProjectedElementCount).toHaveBeenCalledOnce()

    await initialization.dispose()

    expect(detachRuntimeEvidence).toHaveBeenCalledOnce()
  })
})
