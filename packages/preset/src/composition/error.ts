import type {
  PresetCompositionErrorCode,
  PresetCompositionFailureResult
} from '../types'

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
