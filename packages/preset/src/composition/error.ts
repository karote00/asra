import type {
  PresetCompositionErrorCode,
  PresetCompositionFailureResult
} from '../types'
import { PRESET_COMPOSITION_ERROR_CODES } from './constants'

export class PresetCompositionError extends Error {
  readonly result: PresetCompositionFailureResult

  constructor(result: PresetCompositionFailureResult) {
    super(result.message)
    this.name = 'PresetCompositionError'
    this.result = result
  }
}

interface CreatePresetCompositionErrorOptions
  extends Omit<
    PresetCompositionFailureResult,
    'ok' | 'operation' | 'code' | 'message' | 'layer' | 'cleanup'
  > {
  code: PresetCompositionErrorCode
  message: string
}

export const createValidationError = ({
  code,
  message,
  engineId,
  capabilityBundles,
  failedBundleId,
  completedLayers,
  cause
}: CreatePresetCompositionErrorOptions): PresetCompositionError =>
  new PresetCompositionError({
    ok: false,
    code,
    operation: 'apply-preset',
    message,
    layer: 'validation',
    engineId,
    capabilityBundles: [...capabilityBundles],
    failedBundleId,
    completedLayers: [...completedLayers],
    cleanup: {
      state: 'not-required',
      completed: [],
      pending: []
    },
    cause
  })

interface CreateLayerInstallErrorOptions {
  message: string
  layer: Exclude<
    PresetCompositionFailureResult['layer'],
    'validation' | 'cleanup'
  >
  engineId?: string
  capabilityBundles: readonly string[]
  failedBundleId?: string
  completedLayers: readonly string[]
  cause?: unknown
}

export const createLayerInstallError = ({
  message,
  layer,
  engineId,
  capabilityBundles,
  failedBundleId,
  completedLayers,
  cause
}: CreateLayerInstallErrorOptions): PresetCompositionError =>
  new PresetCompositionError({
    ok: false,
    code: PRESET_COMPOSITION_ERROR_CODES.LAYER_INSTALL_FAILED,
    operation: 'apply-preset',
    message,
    layer,
    engineId,
    capabilityBundles: [...capabilityBundles],
    failedBundleId,
    completedLayers: [...completedLayers],
    cleanup: {
      state: 'not-required',
      completed: [],
      pending: []
    },
    cause
  })

interface CreateCleanupErrorOptions {
  operation: PresetCompositionFailureResult['operation']
  engineId?: string
  capabilityBundles: readonly string[]
  completedLayers: readonly string[]
  completedCleanup: readonly string[]
  pendingCleanup: readonly string[]
  cleanupFailures: readonly { key: string; cause: unknown }[]
  applyError?: unknown
}

export const createCleanupError = ({
  operation,
  engineId,
  capabilityBundles,
  completedLayers,
  completedCleanup,
  pendingCleanup,
  cleanupFailures,
  applyError
}: CreateCleanupErrorOptions): PresetCompositionError =>
  new PresetCompositionError({
    ok: false,
    code: PRESET_COMPOSITION_ERROR_CODES.CLEANUP_FAILED,
    operation,
    message: 'Preset composition has pending lifecycle cleanup',
    layer: 'cleanup',
    engineId,
    capabilityBundles: [...capabilityBundles],
    completedLayers: [...completedLayers],
    cleanup: {
      state: 'pending',
      completed: [...completedCleanup],
      pending: [...pendingCleanup]
    },
    cause: {
      cleanupFailures: cleanupFailures.map(({ key, cause }) => ({
        key,
        cause
      })),
      ...(operation === 'apply-preset' ? { applyError } : {})
    }
  })
