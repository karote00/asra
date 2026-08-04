import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
import { PresetProfiles, PRESET_APPLY_ERROR_CODES } from '../constants.js'

import { PresetApplyError } from '../composition/error.js'
import { bindPresetProfileProvider } from '../composition/profile-provider.js'

describe('Preset profile provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('binds the static Pixi provider for 2D without constructing an engine', () => {
    const cleanup = vi.fn()
    const setRenderEngineProvider = vi.fn(() => cleanup)

    const result = bindPresetProfileProvider(
      { setRenderEngineProvider } as never,
      PresetProfiles['2D']
    )

    expect(setRenderEngineProvider).toHaveBeenCalledOnce()
    expect(setRenderEngineProvider).toHaveBeenCalledWith(createPixiRenderEngine)
    expect(result).toEqual({
      presetEngineId: '@asyra/render-engine-pixi',
      cleanup
    })
  })

  it('binds nothing for CUSTOM', () => {
    const setRenderEngineProvider = vi.fn()

    const result = bindPresetProfileProvider(
      { setRenderEngineProvider } as never,
      PresetProfiles.CUSTOM
    )

    expect(setRenderEngineProvider).not.toHaveBeenCalled()
    expect(result).toEqual({ presetEngineId: null, cleanup: null })
  })

  it('maps Core provider rejection without replacing its cause', () => {
    const cause = new Error('Core rejected provider')
    const setRenderEngineProvider = vi.fn(() => {
      throw cause
    })

    let received: unknown
    try {
      bindPresetProfileProvider(
        { setRenderEngineProvider } as never,
        PresetProfiles['2D']
      )
    } catch (error) {
      received = error
    }

    expect(received).toBeInstanceOf(PresetApplyError)
    expect(received).toMatchObject({
      code: PRESET_APPLY_ERROR_CODES.ENGINE_PROVIDER_CONFLICT,
      cause
    })
  })
})
