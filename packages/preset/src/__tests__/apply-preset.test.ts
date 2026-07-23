import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
import {
  PresetDefaults,
  PresetProfiles,
  PRESET_APPLY_ERROR_CODES
} from '../constants'
import * as defaults from '../defaults/install'

import { PresetApplyError } from '../composition/error'
import { applyPreset } from '../preset'

const allDefaults = Object.values(PresetDefaults)

const createCore = ({
  compositionOpen = true,
  hasProvider = false,
  providerFailure
}: {
  compositionOpen?: boolean
  hasProvider?: boolean
  providerFailure?: Error
} = {}) => {
  const providerCleanup = vi.fn()
  const setRenderEngineProvider = vi.fn(() => {
    if (providerFailure) throw providerFailure
    return providerCleanup
  })
  const core = {
    isCompositionOpen: vi.fn(() => compositionOpen),
    hasRenderEngineProvider: vi.fn(() => hasProvider),
    setRenderEngineProvider,
    getPresetDependencies: vi.fn(() => ({})),
    getRegistrations: vi.fn(() => []),
    getRegistration: vi.fn(),
    hasSystemProperty: vi.fn(() => false),
    unregisterSystemProperty: vi.fn(() => false)
  }
  return { core: core as never, providerCleanup, setRenderEngineProvider }
}

const captureApplyError = (run: () => unknown): PresetApplyError => {
  try {
    run()
    throw new Error('Expected PresetApplyError')
  } catch (error) {
    expect(error).toBeInstanceOf(PresetApplyError)
    return error as PresetApplyError
  }
}

describe('applyPreset', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(defaults, 'installPresetDefaults').mockImplementation(
      ({ appliedDefaults }) => Object.freeze([...appliedDefaults])
    )
  })

  it('applies 2D plus all defaults when options are omitted', () => {
    const { core, setRenderEngineProvider } = createCore()

    const result = applyPreset(core)

    expect(defaults.installPresetDefaults).toHaveBeenCalledOnce()
    expect(
      vi.mocked(defaults.installPresetDefaults).mock.calls[0][0].appliedDefaults
    ).toEqual(allDefaults)
    expect(setRenderEngineProvider).toHaveBeenCalledWith(createPixiRenderEngine)
    expect(result).toEqual({
      profile: PresetProfiles['2D'],
      presetEngineId: '@asyra/render-engine-pixi',
      selectedDefaults: allDefaults,
      appliedDefaults: allDefaults
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.selectedDefaults)).toBe(true)
    expect(result).not.toHaveProperty('dispose')
  })

  it('keeps CUSTOM independent from omitted defaults', () => {
    const { core, setRenderEngineProvider } = createCore({
      hasProvider: true
    })

    const result = applyPreset(core, { profile: PresetProfiles.CUSTOM })

    expect(
      vi.mocked(defaults.installPresetDefaults).mock.calls[0][0].appliedDefaults
    ).toEqual(allDefaults)
    expect(setRenderEngineProvider).not.toHaveBeenCalled()
    expect(result).toEqual({
      profile: PresetProfiles.CUSTOM,
      presetEngineId: null,
      selectedDefaults: allDefaults,
      appliedDefaults: allDefaults
    })
  })

  it('installs zero defaults while retaining 2D provider policy', () => {
    const { core, setRenderEngineProvider } = createCore()

    const result = applyPreset(core, { defaults: [] })

    expect(
      vi.mocked(defaults.installPresetDefaults).mock.calls[0][0].appliedDefaults
    ).toEqual([])
    expect(setRenderEngineProvider).toHaveBeenCalledOnce()
    expect(result.selectedDefaults).toEqual([])
    expect(result.appliedDefaults).toEqual([])
  })

  it('reports selected defaults separately from dependency-expanded defaults', () => {
    const { core } = createCore()

    const result = applyPreset(core, {
      defaults: [PresetDefaults.VECTOR_EDITING]
    })

    expect(result.selectedDefaults).toEqual([PresetDefaults.VECTOR_EDITING])
    expect(result.appliedDefaults).toEqual([
      PresetDefaults.VECTOR,
      PresetDefaults.SELECTION,
      PresetDefaults.VECTOR_EDITING
    ])
  })

  it('rejects unavailable profile before defaults or provider mutation', () => {
    const { core, setRenderEngineProvider } = createCore()

    const error = captureApplyError(() =>
      applyPreset(core, { profile: PresetProfiles['3D'] })
    )

    expect(error.code).toBe(PRESET_APPLY_ERROR_CODES.UNAVAILABLE_PROFILE)
    expect(defaults.installPresetDefaults).not.toHaveBeenCalled()
    expect(setRenderEngineProvider).not.toHaveBeenCalled()
  })

  it('rejects duplicate apply before a second mutation', () => {
    const { core, setRenderEngineProvider } = createCore()
    applyPreset(core)

    const error = captureApplyError(() => applyPreset(core))

    expect(error.code).toBe(PRESET_APPLY_ERROR_CODES.ALREADY_APPLIED)
    expect(defaults.installPresetDefaults).toHaveBeenCalledTimes(1)
    expect(setRenderEngineProvider).toHaveBeenCalledTimes(1)
  })

  it('rolls back acquired resources in exact reverse order', () => {
    const { core } = createCore()
    const order: string[] = []
    const applyFailure = new PresetApplyError(
      PRESET_APPLY_ERROR_CODES.DEFAULT_INSTALL_FAILED,
      'module failed'
    )
    vi.mocked(defaults.installPresetDefaults).mockImplementation(
      ({ registerCleanup }) => {
        registerCleanup('first', () => order.push('first'))
        registerCleanup('second', () => order.push('second'))
        throw applyFailure
      }
    )

    const received = captureApplyError(() => applyPreset(core))

    expect(received).toBe(applyFailure)
    expect(order).toEqual(['second', 'first'])
  })

  it('preserves pending cleanup and retries it before the next apply', () => {
    const { core } = createCore()
    const order: string[] = []
    let failCleanup = true
    vi.mocked(defaults.installPresetDefaults).mockImplementationOnce(
      ({ registerCleanup }) => {
        registerCleanup('first', () => order.push('first'))
        registerCleanup('retry', () => {
          order.push('retry')
          if (failCleanup) {
            failCleanup = false
            throw new Error('cleanup failed')
          }
        })
        throw new PresetApplyError(
          PRESET_APPLY_ERROR_CODES.DEFAULT_INSTALL_FAILED,
          'module failed'
        )
      }
    )

    const cleanupError = captureApplyError(() => applyPreset(core))

    expect(cleanupError.code).toBe(PRESET_APPLY_ERROR_CODES.CLEANUP_FAILED)
    expect(cleanupError.completedCleanup).toEqual(['first'])
    expect(cleanupError.pendingCleanup).toEqual(['retry'])
    expect(order).toEqual(['retry', 'first'])

    const result = applyPreset(core, {
      profile: PresetProfiles.CUSTOM,
      defaults: []
    })

    expect(order).toEqual(['retry', 'first', 'retry'])
    expect(defaults.installPresetDefaults).toHaveBeenCalledTimes(2)
    expect(result.profile).toBe(PresetProfiles.CUSTOM)
  })

  it('rolls back installed defaults when provider binding fails', () => {
    const providerFailure = new Error('provider failed')
    const { core } = createCore({ providerFailure })
    const cleanup = vi.fn()
    vi.mocked(defaults.installPresetDefaults).mockImplementation(
      ({ registerCleanup, appliedDefaults }) => {
        registerCleanup('installed-defaults', cleanup)
        return Object.freeze([...appliedDefaults])
      }
    )

    const error = captureApplyError(() => applyPreset(core))

    expect(error.code).toBe(PRESET_APPLY_ERROR_CODES.ENGINE_PROVIDER_CONFLICT)
    expect(error.cause).toBe(providerFailure)
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
