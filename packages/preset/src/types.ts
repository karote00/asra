import type { CorePresetDependencies, CorePresetInstallAPIs } from '@asyra/core'
import type { RenderEngineFactory } from '@asyra/render-engine'
import type { RegistrationRef } from '@asyra/utils'

export type PresetDependencies = CorePresetDependencies
export type PresetCoreAPIs = CorePresetInstallAPIs

export interface PresetApplicationDisposeSuccess {
  ok: true
  operation: 'dispose-preset'
  removed: readonly RegistrationRef[]
  skipped: readonly RegistrationRef[]
}

export interface PresetApplication {
  dispose(): PresetApplicationDisposeSuccess
}

export interface ApplyPresetOptions {
  dependencies?: PresetDependencies
  renderEngineFactory?: RenderEngineFactory
}
