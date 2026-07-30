import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiActionBatch } from '@asyra/ai-agent-runtime'
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
import { viewportApis } from '../../common-apis/viewport'
import { initApp } from '../init-app'
import * as aiDrawingPerformance from '../performance/ai-drawing-performance-profile'
import * as aiStartup from '../../ai/startup'

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
      return {
        ai: {
          api: {
            cancel: vi.fn(() => false),
            execute: vi.fn(async () => ({
              reason: 'provider-unavailable',
              status: 'unavailable'
            }))
          },
          dispose: vi.fn(() => true)
        }
      } as never
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete window.__AsyraE2E__
    delete window.__AsyraAiDrawingPerformance__
  })

  it('applies the default preset with the production AI lifecycle', async () => {
    const initialization = initApp({ serverResponse: null })

    expect(preset.applyPreset).toHaveBeenCalledOnce()
    expect(preset.applyPreset).toHaveBeenCalledWith(core)
    expect(features.initFeatures).toHaveBeenCalledWith({
      aiRuntime: expect.objectContaining({
        run: expect.any(Function)
      })
    })
    expect(initialization).not.toHaveProperty('aiRuntime')
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
      response
    })

    await initialization.dispose()
  })

  it('constructs the complete production Agent composition by default', async () => {
    const disposeFeature = vi.fn(() => true)
    vi.spyOn(features, 'initFeatures').mockImplementation(() => ({
      ai: {
        api: {
          cancel: vi.fn(() => false),
          execute: vi.fn(async () => ({
            code: 'AI_PROVIDER_INVALID_CONFIGURATION',
            stage: 'provider',
            status: 'failed'
          }))
        },
        dispose: disposeFeature
      }
    }))
    const addEventListener = vi.spyOn(window, 'addEventListener')
    const removeEventListener = vi.spyOn(window, 'removeEventListener')

    const initialization = initApp({ serverResponse: null })

    expect(initialization).not.toHaveProperty('aiRuntime')
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

  it('fails startup and disposes Agent resources when feature registration is unavailable', async () => {
    const disposeConfirmation = vi.fn(async () => undefined)
    const disposeHistory = vi.fn()
    const disposeRuntime = vi.fn(async () => undefined)
    vi.spyOn(aiStartup, 'createAsyraDesignAiStartup').mockReturnValue({
      confirmation: {
        dispose: disposeConfirmation
      },
      history: {
        dispose: disposeHistory
      },
      runtime: {
        dispose: disposeRuntime,
        run: vi.fn()
      }
    } as never)
    vi.spyOn(features, 'initFeatures').mockImplementation(() => {
      throw new Error('Agent feature registration failed')
    })

    expect(() => initApp({ serverResponse: null })).toThrow(
      'Agent feature registration failed'
    )

    expect(disposeHistory).toHaveBeenCalledOnce()
    expect(disposeConfirmation).toHaveBeenCalledOnce()
    expect(disposeRuntime).toHaveBeenCalledOnce()
  })

  it('attaches and disposes exact-profile runtime evidence through read-only owners', async () => {
    const detachRuntimeEvidence = vi.fn()
    const readProjectedElementCount = vi
      .spyOn(core.deps.render, 'getProjectedElementCount')
      .mockReturnValue(7)
    const readUndoHistoryDepth = vi
      .spyOn(core.deps.factory, 'getUndoHistoryDepth')
      .mockReturnValue(3)
    const readViewportPosition = vi
      .spyOn(viewportApis, 'getPosition')
      .mockReturnValue({ x: 12, y: 34 })
    const readZoom = vi.spyOn(viewportApis, 'getScale').mockReturnValue(1.25)
    const attachRuntimeEvidence = vi
      .spyOn(aiDrawingPerformance, 'attachAiDrawingPerformanceRuntimeEvidence')
      .mockReturnValue(detachRuntimeEvidence)
    window.__AsyraAiDrawingPerformance__ = {} as never

    const initialization = initApp({ serverResponse: null })

    expect(attachRuntimeEvidence).toHaveBeenCalledOnce()
    expect(attachRuntimeEvidence).toHaveBeenCalledWith(
      window.__AsyraAiDrawingPerformance__,
      {
        readCanonicalElementCount: expect.any(Function),
        readCanonicalElements: expect.any(Function),
        readCanonicalOwnerSnapshot: expect.any(Function),
        readHistoryDepth: expect.any(Function),
        readRenderProjectionElementCount: expect.any(Function),
        readViewportPosition: expect.any(Function),
        readZoom: expect.any(Function),
        subscribeToTransactionStatus: expect.any(Function)
      }
    )
    const runtimeSource = attachRuntimeEvidence.mock.calls[0][1]
    expect(runtimeSource.readCanonicalElementCount()).toBe(0)
    expect(runtimeSource.readHistoryDepth()).toBe(3)
    expect(runtimeSource.readRenderProjectionElementCount()).toBe(7)
    expect(runtimeSource.readViewportPosition()).toEqual({ x: 12, y: 34 })
    expect(runtimeSource.readZoom()).toBe(1.25)
    expect(readUndoHistoryDepth).toHaveBeenCalledOnce()
    expect(readProjectedElementCount).toHaveBeenCalledOnce()
    expect(readViewportPosition).toHaveBeenCalledOnce()
    expect(readZoom).toHaveBeenCalledOnce()

    await initialization.dispose()

    expect(detachRuntimeEvidence).toHaveBeenCalledOnce()
  })
})
