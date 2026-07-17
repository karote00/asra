import type {
  ApplyPresetOptions,
  PresetApplyResult,
  PresetCoreAPIs
} from './types'
import { PRESET_APPLY_ERROR_CODES } from './constants'
import { resolvePresetRequest } from './composition/resolve'
import { bindPresetProfileProvider } from './composition/profile-provider'
import { createPresetApplyResult } from './composition/result'
import { PresetApplyError } from './composition/error'
import { installPresetDefaults } from './defaults/install'
import type { RegisterPresetCleanup } from './defaults/types'

interface PresetCleanupEntry {
  readonly key: string
  readonly dispose: () => void
  completed: boolean
}

interface PendingPresetRollback {
  readonly entries: PresetCleanupEntry[]
  readonly applyError: unknown
}

const appliedCores = new WeakSet<PresetCoreAPIs>()
const pendingRollbacks = new WeakMap<PresetCoreAPIs, PendingPresetRollback>()

const cleanupKeys = (
  entries: readonly PresetCleanupEntry[],
  completed: boolean
): readonly string[] =>
  entries.filter((entry) => entry.completed === completed).map(({ key }) => key)

const rollback = (entries: PresetCleanupEntry[], applyError: unknown): void => {
  const failures: unknown[] = []
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]
    if (entry.completed) continue
    try {
      entry.dispose()
      entry.completed = true
    } catch (error) {
      failures.push(error)
    }
  }

  if (failures.length > 0) {
    throw new PresetApplyError(
      PRESET_APPLY_ERROR_CODES.CLEANUP_FAILED,
      'Preset rollback cleanup is incomplete',
      {
        cause: applyError,
        completedCleanup: cleanupKeys(entries, true),
        pendingCleanup: cleanupKeys(entries, false)
      }
    )
  }
}

const retryPendingRollback = (core: PresetCoreAPIs): void => {
  const pending = pendingRollbacks.get(core)
  if (!pending) return
  try {
    rollback(pending.entries, pending.applyError)
    pendingRollbacks.delete(core)
  } catch (error) {
    throw error
  }
}

export const applyPreset = (
  core: PresetCoreAPIs,
  options?: ApplyPresetOptions
): PresetApplyResult => {
  retryPendingRollback(core)

  const resolved = resolvePresetRequest(core, options, {
    alreadyApplied: appliedCores.has(core)
  })
  const dependencies = core.getPresetDependencies()
  const cleanupEntries: PresetCleanupEntry[] = []
  const registerCleanup: RegisterPresetCleanup = (key, dispose) => {
    cleanupEntries.push({ key, dispose, completed: false })
  }

  try {
    const installedDefaults = installPresetDefaults({
      core,
      dependencies,
      appliedDefaults: resolved.appliedDefaults,
      registerCleanup
    })
    const provider = bindPresetProfileProvider(core, resolved.profile)
    if (provider.cleanup) {
      registerCleanup('profile:render-engine-provider', provider.cleanup)
    }
    const result = createPresetApplyResult({
      profile: resolved.profile,
      presetEngineId: provider.presetEngineId,
      selectedDefaults: resolved.selectedDefaults,
      appliedDefaults: installedDefaults
    })
    appliedCores.add(core)
    return result
  } catch (error) {
    try {
      rollback(cleanupEntries, error)
    } catch (cleanupError) {
      pendingRollbacks.set(core, {
        entries: cleanupEntries,
        applyError: error
      })
      throw cleanupError
    }
    if (error instanceof PresetApplyError) {
      throw error
    }
    throw new PresetApplyError(
      PRESET_APPLY_ERROR_CODES.DEFAULT_INSTALL_FAILED,
      'Preset apply failed',
      { cause: error }
    )
  }
}
