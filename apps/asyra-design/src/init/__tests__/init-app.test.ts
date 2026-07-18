import { beforeEach, describe, expect, it, vi } from 'vitest'

const { calls, core, applyPreset } = vi.hoisted(() => ({
  calls: [] as string[],
  core: { name: 'app-core' },
  applyPreset: vi.fn(() => {
    calls.push('preset')
  })
}))

vi.mock('@asyra/preset', () => ({ applyPreset }))
vi.mock('../../contexts', () => ({ default: core }))
vi.mock('../diagnostics/init-load-diagnostics', () => ({
  initLoadDiagnostics: () => calls.push('diagnostics')
}))
vi.mock('../diagnostics/init-canvas-pipeline-debugger', () => ({
  initCanvasPipelineDebugger: () => {
    calls.push('canvas-pipeline-debugger')
    return Promise.resolve(undefined)
  }
}))
vi.mock('../derived-state/init-selection-compatibility', () => ({
  initSelectionCompatibility: () => calls.push('selection-compatibility')
}))
vi.mock('../derived-state/init-path-editing-continuation', () => ({
  initPathEditingContinuation: () => calls.push('path-editing-continuation')
}))
vi.mock('../capabilities/init-area-selection', () => ({
  initAreaSelection: () => calls.push('area-selection')
}))
vi.mock('../capabilities/init-gradient-fill-editing', () => ({
  initGradientFillEditing: () => calls.push('gradient-fill-editing')
}))
vi.mock('../capabilities/init-vector-icon-data', () => ({
  initVectorIconData: () => calls.push('vector-icon-data')
}))
vi.mock('../foundation/init-input-system', () => ({
  initInputSystem: () => calls.push('input-system')
}))
vi.mock('../foundation/init-features', () => ({
  initFeatures: () => calls.push('features')
}))
vi.mock('../../common-apis/element', () => ({ elementApis: {} }))
vi.mock('../../common-apis/strokes', () => ({ strokeApis: {} }))

import { initApp } from '../init-app'

describe('initApp preset composition', () => {
  beforeEach(() => {
    calls.length = 0
    applyPreset.mockClear()
  })

  it('applies the default preset before app-owned initialization', () => {
    initApp()

    expect(applyPreset).toHaveBeenCalledOnce()
    expect(applyPreset).toHaveBeenCalledWith(core)
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
