import type { CorePresetDependencies, CorePresetInstallAPIs } from '@asyra/core'
import type { RenderEngineFactory } from '@asyra/render-engine'

export type PresetDependencies = CorePresetDependencies
export type PresetCoreAPIs = CorePresetInstallAPIs

export interface ApplyPresetOptions {
  dependencies?: PresetDependencies
  renderEngineFactory: RenderEngineFactory
}
