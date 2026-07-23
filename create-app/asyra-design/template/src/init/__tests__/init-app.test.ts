import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { initApp } from '../init-app'

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
  })

  it('applies the default preset before app-owned initialization', () => {
    initApp()

    expect(preset.applyPreset).toHaveBeenCalledOnce()
    expect(preset.applyPreset).toHaveBeenCalledWith(core)
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
  })
})
