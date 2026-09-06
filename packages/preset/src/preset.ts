import type {
  ApplyPresetOptions,
  PresetApplyResult,
  PresetCoreAPIs
} from './types.js'
import { PRESET_APPLY_ERROR_CODES } from './constants.js'
import { resolvePresetRequest } from './composition/resolve.js'
import { bindPresetProfileProvider } from './composition/profile-provider.js'
import { createPresetApplyResult } from './composition/result.js'
import { PresetApplyError } from './composition/error.js'
import { installPresetDefaults } from './defaults/install.js'
import type { RegisterPresetCleanup } from './defaults/types.js'
import { PRESET_REGISTRATION_OWNER } from './registration.js'

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

const releaseEntries = (entries: PresetCleanupEntry[]): unknown[] => {
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

  return failures
}

const rollback = (entries: PresetCleanupEntry[], applyError: unknown): void => {
  const failures = releaseEntries(entries)
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

const disposeRuntime = (entries: PresetCleanupEntry[]): void => {
  const failures = releaseEntries(entries)
  if (failures.length > 0) {
    throw new PresetApplyError(
      PRESET_APPLY_ERROR_CODES.CLEANUP_FAILED,
      'Preset runtime cleanup is incomplete',
      {
        cause: failures[0],
        completedCleanup: cleanupKeys(entries, true),
        pendingCleanup: cleanupKeys(entries, false)
      }
    )
  }
}

const retryPendingRollback = (core: PresetCoreAPIs): void => {
  const pending = pendingRollbacks.get(core)
  if (!pending) return
  rollback(pending.entries, pending.applyError)
  pendingRollbacks.delete(core)
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
    core.registerRuntimeCleanup?.(PRESET_REGISTRATION_OWNER.packageName, () =>
      disposeRuntime(cleanupEntries)
    )
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
