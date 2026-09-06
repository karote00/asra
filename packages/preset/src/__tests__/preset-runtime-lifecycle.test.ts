import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPreset } from '../preset.js'
import { PresetProfiles } from '../constants.js'
import * as defaults from '../defaults/install.js'

const createCore = () => {
  const registerRuntimeCleanup = vi.fn(
    (_key: string, _cleanup: () => void) => () => undefined
  )
  return {
    isCompositionOpen: () => true,
    hasRenderEngineProvider: () => false,
    getPresetDependencies: () => ({}),
    setRenderEngineProvider: vi.fn(() => () => undefined),
    registerRuntimeCleanup
  }
}

describe('Successful Preset runtime lifecycle handoff', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retains successful cleanup without adding a lifecycle handle to the apply result', () => {
    const core = createCore(),
      calls: string[] = []
    vi.spyOn(defaults, 'installPresetDefaults').mockImplementation(
      ({ registerCleanup }) => {
        registerCleanup('first', () => {
          calls.push('first')
        })
        registerCleanup('second', () => {
          calls.push('second')
        })
        return []
      }
    )
    const result = applyPreset(core as never, {
      profile: PresetProfiles.CUSTOM
    })
    expect(result).not.toHaveProperty('dispose')
    expect(Object.isFrozen(result)).toBe(true)
    expect(core.registerRuntimeCleanup).toHaveBeenCalledOnce()
    expect(calls).toEqual([])
    const dispose = core.registerRuntimeCleanup.mock.calls[0][1]
    dispose()
    dispose()
    expect(calls).toEqual(['second', 'first'])
    expect(() =>
      applyPreset(core as never, { profile: PresetProfiles.CUSTOM })
    ).toThrow('already')
  })

  it('attempts every retained cleanup and reports the failed resource and cause', () => {
    const core = createCore(),
      cause = new Error('resource failed'),
      successful = vi.fn()
    vi.spyOn(defaults, 'installPresetDefaults').mockImplementation(
      ({ registerCleanup }) => {
        registerCleanup('successful', successful)
        registerCleanup('failed', () => {
          throw cause
        })
        return []
      }
    )
    applyPreset(core as never, { profile: PresetProfiles.CUSTOM })
    expect(core.registerRuntimeCleanup).toHaveBeenCalledOnce()
    let failure: unknown
    try {
      core.registerRuntimeCleanup.mock.calls[0][1]()
    } catch (error) {
      failure = error
    }
    expect(successful).toHaveBeenCalledOnce()
    expect(failure).toMatchObject({
      code: 'CLEANUP_FAILED',
      cause,
      completedCleanup: ['successful'],
      pendingCleanup: ['failed']
    })
  })

  it('rolls back acquired resources if Core rejects the lifecycle handoff', () => {
    const core = createCore(),
      cleanup = vi.fn(),
      cause = new Error('handoff failed')
    vi.spyOn(defaults, 'installPresetDefaults').mockImplementation(
      ({ registerCleanup }) => {
        registerCleanup('resource', cleanup)
        return []
      }
    )
    core.registerRuntimeCleanup.mockImplementation(() => {
      throw cause
    })
    expect(() =>
      applyPreset(core as never, { profile: PresetProfiles.CUSTOM })
    ).toThrow('Preset apply failed')
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
