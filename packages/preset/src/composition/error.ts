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
